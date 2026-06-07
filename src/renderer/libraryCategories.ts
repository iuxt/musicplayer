export type LibraryCategory = "songs" | "albums" | "artists" | "folders";

export const libraryCategories: Array<{
  id: LibraryCategory;
  label: string;
}> = [
  { id: "songs", label: "Songs" },
  { id: "albums", label: "Albums" },
  { id: "artists", label: "Artists" },
  { id: "folders", label: "Folders" }
];
