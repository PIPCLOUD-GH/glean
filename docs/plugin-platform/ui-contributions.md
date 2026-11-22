# UI Contributions

> Status: UI-R0/R1 first slice, experimental behind feature flags. Target release: Glean 1.6.0.

`contributes.uiComponents` lets a plugin add Host-rendered actions to a user-controlled UI slot. The first available slot is `floating-layer`.

## Safety model

- The plugin declares data only. It receives no React, DOM, CSS, Node, network, file, note, or workspace access.
- The Host validates component IDs, icons, slots, platforms, and actions during installation and again before rendering.
- The first action is `navigation.open`; its target must be one of the Host allowlisted destinations.
- User layout is stored separately from the plugin Manifest. A plugin cannot force a screen position or overwrite another plugin's layout.
- Runtime IDs use `<pluginId>/<componentId>`.

## Example

```json
{
  "contributes": {
    "uiComponents": [{
      "id": "tasks",
      "kind": "action",
      "label": "Tasks",
      "icon": "tasks",
      "allowedSlots": ["floating-layer"],
      "defaultPlacement": { "slot": "floating-layer", "order": 20 },
      "action": { "type": "navigation.open", "target": "tasks" }
    }]
  }
}
```

See `examples/plugins/floating-dock` and `examples/plugins/alternative-launcher`. Both use the same public contribution path; the Host contains no plugin-ID special cases.

## Feature flags

The flags are fail-closed and hierarchical:

```text
GLEAN_EXTENSIONS_V21
└── GLEAN_UI_EXTENSIONS
    └── GLEAN_UI_LAYOUT_EDITOR
        └── GLEAN_SANDBOXED_PLUGIN_UI
```

Only `GLEAN_UI_EXTENSIONS` is consumed by this slice. The layout editor and sandboxed custom UI flags reserve later delivery stages and do not imply those products are available.

## Current limits

- Only the `action` component kind and `floating-layer` slot are available.
- Layout persistence is user-scoped and local to the device/browser profile.
- The dock can be dragged to five safe anchor positions; keyboard users can cycle positions from the drag handle.
- Custom React, Vue, HTML, CSS, iframe UI, arbitrary commands, and cross-device layout sync are not available yet.
