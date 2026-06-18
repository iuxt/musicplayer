export type LibraryCategory = "songs" | "albums" | "artists" | "folders";

export const libraryCategories: Array<{
  id: LibraryCategory;
  label: string;
}> = [
  { id: "songs", label: "歌曲" },
  { id: "albums", label: "专辑" },
  { id: "artists", label: "歌手" },
  { id: "folders", label: "文件夹" }
];
