import { defineCollection, z } from 'astro:content';

const staticCollection = defineCollection({
  type: 'content',
  schema: z.object({
    name: z.string(),
    description: z.string().optional(),
  }),
});

export const collections = {
  staticCollection,
};
