import { createRouter } from '@tanstack/react-router';

import { routeTree } from './routeTree.gen';

// Start は毎回新しいインスタンスを返す getRouter を要求する
export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
  });
}
