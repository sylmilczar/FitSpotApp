import { createFixtureUsers } from "./fixtures";

export async function setup(): Promise<void> {
  await createFixtureUsers();
}
