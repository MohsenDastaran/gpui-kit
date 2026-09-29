import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { componentMarkdownLoader } from './lib/component-loader';

const pageSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  order: z.number().optional(),
  example: z.union([z.string(), z.literal(false)]).optional(),
  exampleKind: z.enum(['base', 'component']).optional(),
});

const docs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './docs' }),
  schema: pageSchema,
});

const component = defineCollection({
  loader: componentMarkdownLoader('./component'),
  schema: pageSchema,
});

const shell = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './shell' }),
  schema: pageSchema,
});

const base = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './base' }),
  schema: pageSchema,
});

export const collections = {
  docs,
  component,
  shell,
  base,
};
