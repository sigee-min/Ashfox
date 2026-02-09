import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import { CapabilityStatusTables } from '@/components/docs/capability-status-tables';

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    CapabilityStatusTables,
    ...components,
  };
}
