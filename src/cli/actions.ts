export type RokuActionTarget = {
  literal: (text: string) => Promise<void>;
  search: (params: Record<string, string>) => Promise<void>;
  getApp: (key: string) => Promise<any | undefined>;
  launch: (app: any) => Promise<void>;
  [key: string]: any;
};

export type ActionPayload =
  | { type: "key"; key: string }
  | { type: "text"; text: string }
  | { type: "search"; params: Record<string, string> }
  | { type: "launch"; appKey: string };

export async function executeAction(roku: RokuActionTarget, action: ActionPayload): Promise<void> {
  switch (action.type) {
    case "key": {
      await callKey(roku, action.key);
      return;
    }
    case "text": {
      await roku.literal(action.text);
      return;
    }
    case "search": {
      await roku.search(action.params);
      return;
    }
    case "launch": {
      const app = await roku.getApp(action.appKey);
      if (!app) throw new Error(`App ${action.appKey} not found`);
      await roku.launch(app);
      return;
    }
    default:
      throw new Error("Unsupported action");
  }
}

export async function callKey(roku: RokuActionTarget, name: string): Promise<void> {
  const action = (roku as Record<string, (() => Promise<void>) | undefined>)[name];
  if (!action) {
    throw new Error(`Key not supported: ${name}`);
  }
  await action();
}

export function searchInstalledApps(apps: Array<{ id: string; name: string }>, term: string) {
  const needle = term.toLowerCase();
  return apps.filter(
    (app) => app.name.toLowerCase().includes(needle) || app.id.includes(term)
  );
}
