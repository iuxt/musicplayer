import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { Track } from "../shared/types.js";
import {
  addTrackToM3uPlaylistFile,
  createM3uPlaylistFile,
  deleteM3uPlaylistFile,
  readLibraryPlaylists,
  removeTrackFromM3uPlaylistFile,
  renameM3uPlaylistFile
} from "./playlists.js";

describe("m3u playlist files", () => {
  it("creates an empty m3u playlist under the playlists folder", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "music-create-playlist-"));

    const playlist = await createM3uPlaylistFile(root, "  New Mix  ");

    expect(playlist).toMatchObject({
      name: "New Mix",
      filePath: path.join(root, "playlists", "New Mix.m3u"),
      trackIds: []
    });
    await expect(readFile(playlist.filePath, "utf8")).resolves.toBe("#EXTM3U\n");
  });

  it("renames a playlist file and preserves track entries", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "music-rename-playlist-"));
    const playlistsFolder = path.join(root, "playlists");
    await mkdir(playlistsFolder, { recursive: true });
    const track = makeTrack(root, "Song.wav", "track-1");
    const oldPath = path.join(playlistsFolder, "Old Name.m3u");
    await writeFile(oldPath, ["#EXTM3U", "#EXTINF:180,Song", "../Song.wav"].join("\n"));
    const [playlist] = await readLibraryPlaylists(root, [track], []);

    const renamed = await renameM3uPlaylistFile(root, playlist, "New Name");

    expect(renamed).toMatchObject({
      name: "New Name",
      filePath: path.join(playlistsFolder, "New Name.m3u"),
      trackIds: [track.id]
    });
    await expect(readFile(oldPath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(renamed.filePath, "utf8")).resolves.toContain("../Song.wav");
  });

  it("removes a track from a playlist without deleting the audio file", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "music-remove-playlist-track-"));
    const playlistsFolder = path.join(root, "playlists");
    await mkdir(playlistsFolder, { recursive: true });
    const firstTrack = makeTrack(root, "First.wav", "first");
    const secondTrack = makeTrack(root, "Second.wav", "second");
    await writeFile(firstTrack.filePath, "audio");
    await writeFile(secondTrack.filePath, "audio");
    const playlistPath = path.join(playlistsFolder, "Mix.m3u");
    await writeFile(
      playlistPath,
      ["#EXTM3U", "#EXTINF:180,First", "../First.wav", "#EXTINF:180,Second", "../Second.wav"].join("\n")
    );
    const [playlist] = await readLibraryPlaylists(root, [firstTrack, secondTrack], []);

    const updated = await removeTrackFromM3uPlaylistFile(root, playlist, firstTrack);

    expect(updated.trackIds).toEqual([secondTrack.id]);
    const contents = await readFile(playlistPath, "utf8");
    expect(contents).not.toContain("First.wav");
    expect(contents).not.toContain("#EXTINF:180,First");
    expect(contents).toContain("../Second.wav");
    await expect(readFile(firstTrack.filePath, "utf8")).resolves.toBe("audio");
  });

  it("adds a track to a playlist using a relative m3u path", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "music-add-playlist-track-"));
    const playlistsFolder = path.join(root, "playlists");
    const albumFolder = path.join(root, "Album");
    await mkdir(playlistsFolder, { recursive: true });
    await mkdir(albumFolder, { recursive: true });
    const track = makeTrack(root, "Album/Song.wav", "track-1");
    await writeFile(track.filePath, "audio");
    const playlistPath = path.join(playlistsFolder, "Mix.m3u");
    await writeFile(playlistPath, "#EXTM3U\n");
    const [playlist] = await readLibraryPlaylists(root, [track], []);

    const updated = await addTrackToM3uPlaylistFile(root, playlist, track);

    expect(updated.trackIds).toEqual([track.id]);
    await expect(readFile(playlistPath, "utf8")).resolves.toBe("#EXTM3U\n../Album/Song.wav\n");
  });

  it("does not add the same track to a playlist twice", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "music-duplicate-playlist-track-"));
    const playlistsFolder = path.join(root, "playlists");
    await mkdir(playlistsFolder, { recursive: true });
    const track = makeTrack(root, "Song.wav", "track-1");
    await writeFile(track.filePath, "audio");
    const playlistPath = path.join(playlistsFolder, "Mix.m3u");
    await writeFile(playlistPath, ["#EXTM3U", "../Song.wav"].join("\n"));
    const [playlist] = await readLibraryPlaylists(root, [track], []);

    const updated = await addTrackToM3uPlaylistFile(root, playlist, track);

    expect(updated.trackIds).toEqual([track.id]);
    await expect(readFile(playlistPath, "utf8")).resolves.toBe("#EXTM3U\n../Song.wav");
  });

  it("deletes a playlist through the supplied file remover", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "music-delete-playlist-"));
    const playlistsFolder = path.join(root, "playlists");
    await mkdir(playlistsFolder, { recursive: true });
    const playlistPath = path.join(playlistsFolder, "Mix.m3u");
    await writeFile(playlistPath, "#EXTM3U\n");
    const [playlist] = await readLibraryPlaylists(root, [], []);
    const removeFile = vi.fn(async () => undefined);

    await deleteM3uPlaylistFile(root, playlist, removeFile);

    expect(removeFile).toHaveBeenCalledWith(playlistPath);
  });
});

function makeTrack(root: string, fileName: string, id: string): Track {
  const filePath = path.join(root, fileName);

  return {
    id,
    filePath,
    title: path.basename(fileName, path.extname(fileName)),
    artist: "Artist",
    album: "Album",
    duration: 180,
    trackNumber: null,
    extension: "wav",
    artworkId: null,
    artworkPath: null,
    lyricsPath: null,
    hasLyrics: false,
    folderPath: "."
  };
}
