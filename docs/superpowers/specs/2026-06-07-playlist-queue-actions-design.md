# Playlist Queue Actions Design

## Goal

Add playlist management actions for the current playback queue. The user can clear the queue or remove individual tracks from it. These actions never delete local audio files and do not alter the scanned library.

## Behavior

- The playlist panel shows a clear-queue control when the displayed queue has tracks.
- Each playlist row has a remove control.
- Removing a track removes only that track from the current queue.
- Clearing the queue removes all tracks from the current queue.
- The library browser remains unchanged after queue operations.
- Removing or clearing the currently playing track does not delete the file. Playback state should remain stable instead of abruptly deleting library data.
- After the queue is explicitly cleared, the playlist stays empty instead of falling back to the filtered library list.

## UI

Use compact icon buttons in the playlist panel:

- A clear action in the playlist heading.
- A remove action on each row.
- An empty queue state when there are no queue tracks.

Controls should have accessible labels so they are discoverable by tests and assistive technology.

## State Model

The renderer should distinguish between:

- Default library-backed queue before the user edits the playlist.
- Explicit user-edited queue after clear or remove actions.

This prevents an empty explicit queue from being treated as "use the full filtered library".

## Tests

Focused renderer tests should cover:

- Clearing the playlist empties the playlist panel.
- Removing one track removes it from the playlist panel.
- Queue operations do not remove tracks from the library browser.
- An explicitly empty queue does not repopulate from the filtered library list.
