// Host owns consent, destination selection, and the persistent capture queue.
globalThis.__gleanPluginModule = { actions: {
  "capture-article": async ({ input, glean }) => {
    const key = `assistant:${input.itemId}`;
    const prior = await glean.storage.get({ key });
    if (prior) return prior;
    const note = await glean.capture.importUrl({ url: input.url, notebookId: input.notebookId });
    await glean.storage.set({ key, value: note });
    return note;
  },
} };
