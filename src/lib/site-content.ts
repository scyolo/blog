import { getCollection } from "astro:content";
import { getSortedPosts } from "../utils/getSortedPosts";
export const categories = { knowledge: "知识笔记", essay: "随笔" } as const;
export const getPosts = async () =>
  getSortedPosts(await getCollection("posts"));
export const getProjects = async () =>
  (await getCollection("projects")).filter(
    project => import.meta.env.DEV || project.data.draft === false
  );
