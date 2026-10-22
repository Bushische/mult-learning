// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import "../../../test/setup";
import type { AdminUser, Game } from "@mult/shared";
import { api } from "../../../lib/api-client";
import { useAuthStore } from "../../../stores/auth-store";
import { type ApiStub, createApiStub, renderApp, resetSession } from "../../../test/harness";
import { generateQuestion } from "../../play/lib/question";

function makeGame(id: string, name: string, overrides: Partial<Game> = {}): Game {
  return {
    id,
    name,
    rangeA: { min: 2, max: 4 },
    rangeB: { min: 1, max: 4 },
    allowedCombinations: null,
    variantCount: 3,
    baseTimeReward: 10,
    timePenalty: 5,
    maxDailyTime: 3600,
    hints: [],
    ...overrides,
  };
}

interface ServerState {
  games: Game[];
  users: (AdminUser & { pin: string })[];
}

function installServer(): { state: ServerState; stub: ApiStub } {
  const state: ServerState = {
    games: [makeGame("g-easy", "Easy Twos"), makeGame("g-mixed", "Mixed Table")],
    users: [
      {
        id: "u-admin",
        username: "admin",
        role: "admin",
        timeBankSeconds: 0,
        games: [],
        createdAt: "2026-10-01T00:00:00.000Z",
        pin: "1289",
      },
      {
        id: "u-child1",
        username: "child1",
        role: "user",
        timeBankSeconds: 0,
        games: ["g-easy", "g-mixed"],
        createdAt: "2026-10-01T00:00:00.000Z",
        pin: "2468",
      },
    ],
  };

  const stub = createApiStub({
    "GET /me": () => ({
      data: { id: "u-admin", username: "admin", role: "admin", timeBankSeconds: 0 },
    }),
    "GET /users": () => ({
      data: state.users.map((user) => ({ id: user.id, username: user.username })),
    }),
    "GET /games": () => ({
      data: state.games.filter((game) => state.users[1]?.games.includes(game.id)),
    }),
    "GET /admin/games": () => ({ data: state.games }),
    "GET /admin/users": () => ({
      data: state.users.map(({ pin, ...user }) => user),
    }),
    "POST /admin/games": (call) => {
      const body = call.body as Game;
      const created = makeGame(`g-${state.games.length + 1}`, body.name, body);
      state.games.push(created);
      return { status: 201, data: created };
    },
    "PATCH /admin/games/:id": (call) => {
      const id = call.url.split("/").pop() as string;
      const game = state.games.find((entry) => entry.id === id);
      if (!game) {
        return { status: 404, data: { error: { code: "NOT_FOUND", message: "nope" } } };
      }
      const patch = call.body as Partial<Game>;
      Object.assign(game, patch);
      return { data: game };
    },
    "DELETE /admin/games/:id": (call) => {
      const id = call.url.split("/").pop() as string;
      state.games = state.games.filter((entry) => entry.id !== id);
      return { status: 204 };
    },
    "PUT /admin/users/:id/games": (call) => {
      const id = call.url.split("/").slice(-2, -1)[0] as string;
      const body = call.body as { gameIds: string[] };
      const user = state.users.find((entry) => entry.id === id);
      if (user) user.games = body.gameIds;
      return { data: body.gameIds };
    },
  });

  return { state, stub };
}

async function openGamesTab(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Games" }));
  await screen.findByTestId("game-studio");
}

beforeEach(() => {
  resetSession();
  useAuthStore.setState({
    accessToken: "token-admin",
    user: { id: "u-admin", username: "admin", role: "admin" },
  });
});

describe("T14 — admin game studio", () => {
  it("case 1: a new game is created and shows up for the child", async () => {
    const { state, stub } = installServer();
    const user = userEvent.setup();
    renderApp("/admin");
    await openGamesTab(user);

    await user.type(screen.getByLabelText("Game name"), "Hard Sevens");
    await user.clear(screen.getByLabelText("Factor A min"));
    await user.type(screen.getByLabelText("Factor A min"), "7");
    await user.clear(screen.getByLabelText("Factor A max"));
    await user.type(screen.getByLabelText("Factor A max"), "7");
    await user.clear(screen.getByLabelText("Factor B min"));
    await user.type(screen.getByLabelText("Factor B min"), "2");
    await user.clear(screen.getByLabelText("Factor B max"));
    await user.type(screen.getByLabelText("Factor B max"), "9");
    await user.click(screen.getByRole("button", { name: "More variants" }));
    await user.type(screen.getByLabelText("Hint text"), "Times seven is tricky");
    await user.click(screen.getByRole("button", { name: "Add hint" }));
    await user.click(screen.getByRole("button", { name: "Create game" }));

    await waitFor(() => {
      const post = stub.calls.find(
        (call) => call.method === "POST" && call.url === "/api/admin/games",
      );
      expect(post?.body).toMatchObject({
        name: "Hard Sevens",
        rangeA: { min: 7, max: 7 },
        rangeB: { min: 2, max: 9 },
        variantCount: 4,
        hints: [{ factor: 10, text: "Times seven is tricky" }],
      });
    });

    const created = state.games.find((game) => game.name === "Hard Sevens");
    expect(created).toBeTruthy();

    // assign it to the child and check the child's dashboard + play screen
    await api.put("/admin/users/u-child1/games", { gameIds: ["g-easy", "g-mixed", created?.id] });

    const view = renderApp("/");
    expect((await screen.findAllByText("Hard Sevens")).length).toBeGreaterThan(0);
    expect(await screen.findByTestId(`game-economics-${created?.id}`)).toHaveTextContent(
      "+10s correct / −5s wrong",
    );
    view.unmount();

    renderApp(`/play/${created?.id}`);
    expect(await screen.findByTestId("question")).toBeInTheDocument();
    expect((await screen.findAllByText("Hard Sevens")).length).toBeGreaterThan(0);
  });

  it("case 2: an invalid range shows inline errors and never submits", async () => {
    const { stub } = installServer();
    const user = userEvent.setup();
    renderApp("/admin");
    await openGamesTab(user);

    await user.type(screen.getByLabelText("Game name"), "Broken");
    await user.clear(screen.getByLabelText("Factor A min"));
    await user.type(screen.getByLabelText("Factor A min"), "5");
    await user.clear(screen.getByLabelText("Factor A max"));
    await user.type(screen.getByLabelText("Factor A max"), "2");
    await user.click(screen.getByRole("button", { name: "Create game" }));

    expect(await screen.findByTestId("error-rangeA.min")).toBeInTheDocument();
    expect(
      stub.calls.some((call) => call.method === "POST" && call.url === "/api/admin/games"),
    ).toBe(false);

    await user.clear(screen.getByLabelText("Factor A min"));
    await user.type(screen.getByLabelText("Factor A min"), "0");
    await user.click(screen.getByRole("button", { name: "Create game" }));
    expect(await screen.findByTestId("error-rangeA.min")).toBeInTheDocument();
    expect(
      stub.calls.some((call) => call.method === "POST" && call.url === "/api/admin/games"),
    ).toBe(false);
  });

  it("case 3: pinned combinations are saved and drive the play feature", async () => {
    const { stub, state } = installServer();
    const user = userEvent.setup();
    renderApp("/admin");
    await openGamesTab(user);

    await user.type(screen.getByLabelText("Game name"), "Pinned");
    await user.clear(screen.getByLabelText("Factor A min"));
    await user.type(screen.getByLabelText("Factor A min"), "3");
    await user.clear(screen.getByLabelText("Factor A max"));
    await user.type(screen.getByLabelText("Factor A max"), "3");
    await user.clear(screen.getByLabelText("Factor B min"));
    await user.type(screen.getByLabelText("Factor B min"), "4");
    await user.clear(screen.getByLabelText("Factor B max"));
    await user.type(screen.getByLabelText("Factor B max"), "6");

    await user.click(screen.getByLabelText("3x4"));
    await user.click(screen.getByLabelText("3x6"));
    await user.click(screen.getByRole("button", { name: "Create game" }));

    await waitFor(() => {
      const post = stub.calls.find(
        (call) => call.method === "POST" && call.url === "/api/admin/games",
      );
      expect(post?.body).toMatchObject({
        allowedCombinations: [
          [3, 4],
          [3, 6],
        ],
      });
    });

    const saved = state.games.find((game) => game.name === "Pinned");
    expect(saved?.allowedCombinations).toEqual([
      [3, 4],
      [3, 6],
    ]);
    // the play feature only rolls the pinned combinations
    const random = () => 0.5;
    for (let i = 0; i < 20; i += 1) {
      const question = generateQuestion(saved as Game, random);
      expect([304, 306]).toContain(question.factorA * 100 + question.factorB);
    }

    // the matrix is empty again after the save — the whole range is used
    expect(screen.getByTestId("combination-matrix")).toHaveTextContent("whole range");

    // a game without pinned combinations is saved with null
    await user.type(screen.getByLabelText("Game name"), "Whole range");
    await user.click(screen.getByRole("button", { name: "Create game" }));
    await waitFor(() => {
      const posts = stub.calls.filter(
        (call) => call.method === "POST" && call.url === "/api/admin/games",
      );
      expect(posts[posts.length - 1]?.body).toMatchObject({ allowedCombinations: null });
    });
  });

  it("case 4: editing a game changes the economics for the child", async () => {
    const { stub } = installServer();
    const user = userEvent.setup();
    renderApp("/admin");
    await openGamesTab(user);

    const row = await screen.findByTestId("admin-game-Easy Twos");
    await user.click(within(row).getByRole("button", { name: "Edit" }));
    await user.clear(screen.getByLabelText("Reward seconds"));
    await user.type(screen.getByLabelText("Reward seconds"), "20");
    await user.clear(screen.getByLabelText("Penalty seconds"));
    await user.type(screen.getByLabelText("Penalty seconds"), "8");
    await user.click(screen.getByRole("button", { name: "Save game" }));

    await waitFor(() => {
      const patch = stub.calls.find(
        (call) => call.method === "PATCH" && call.url.startsWith("/api/admin/games/"),
      );
      expect(patch?.body).toMatchObject({ baseTimeReward: 20, timePenalty: 8 });
    });

    const view = renderApp("/");
    expect(await screen.findByTestId("game-economics-g-easy")).toHaveTextContent(
      "+20s correct / −8s wrong",
    );
    view.unmount();
  });

  it("T21 case 1–3: the admin game list reads 'N options' with unchanged economics", async () => {
    installServer();
    const user = userEvent.setup();
    renderApp("/admin");
    await openGamesTab(user);

    const row = await screen.findByTestId("admin-game-Easy Twos");
    expect(row).toHaveTextContent("3 options");
    expect(row).toHaveTextContent("+10s / −5s");
    expect(row).not.toHaveTextContent("3 answers");
  });

  it("case 5: duplicating a game creates an independent copy", async () => {
    const { state, stub } = installServer();
    const user = userEvent.setup();
    renderApp("/admin");
    await openGamesTab(user);

    const row = await screen.findByTestId("admin-game-Easy Twos");
    await user.click(within(row).getByRole("button", { name: "Duplicate" }));

    await waitFor(() => {
      const post = stub.calls.find(
        (call) => call.method === "POST" && call.url === "/api/admin/games",
      );
      expect(post?.body).toMatchObject({ name: "copy of Easy Twos" });
    });

    const copy = state.games.find((game) => game.name === "copy of Easy Twos");
    expect(copy).toBeTruthy();
    expect(copy?.id).not.toBe("g-easy");

    // deleting the copy leaves the original assigned
    const copyRow = await screen.findByTestId("admin-game-copy of Easy Twos");
    await user.click(within(copyRow).getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      const del = stub.calls.find(
        (call) => call.method === "DELETE" && call.url.startsWith("/api/admin/games/"),
      );
      expect(del?.url).toContain(copy?.id);
    });
    expect(state.games.find((game) => game.id === "g-easy")).toBeTruthy();
    expect(state.users[1]?.games).toContain("g-easy");
  });
});
