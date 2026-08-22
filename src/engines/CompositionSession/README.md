# CompositionSession

`CompositionSession` is the production editing-operation wrapper for the newspaper composition pipeline.

Each user operation becomes one session:

- resize story
- move story
- delete story
- insert story
- image resize
- image crop
- headline change

The session layer does not replace solver engines. It wraps existing composition, preview, layout, commit, and history operations.

## Flow

1. `CompositionSessionManager.begin()`
2. Preview loop through existing preview/layout engines
3. `CompositionSessionManager.preview()`
4. Mouse release validation
5. Existing commit engine
6. `CompositionSessionManager.commit()`
7. Immutable `CompositionTransaction`
8. History append
9. `CompositionSession.end`

## Guarantees

- No editor/document mutation during preview
- 60 FPS preview throttling
- Nested preview update accounting
- One commit only
- Atomic transaction creation
- Immutable history
- Undo/redo/jump-to-revision support
- Rollback and cancel without history writes

## Live Resize Integration

`LiveResizeController` now begins and updates a composition session internally. Its external API is preserved.

During drag it records preview metrics only. On release, it commits through the existing `LayoutCommitEngine`, then records a single `CompositionTransaction`.
