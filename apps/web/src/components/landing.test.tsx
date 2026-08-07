import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Landing } from './landing.tsx';

describe('Landing', () => {
  it('アプリ名を見出しレベル1で表示する', () => {
    render(<Landing />);

    expect(
      screen.getByRole('heading', { level: 1, name: /Haregi/ }),
    ).toBeInTheDocument();
  });

  it('アプリが何をするものかの説明を表示する', () => {
    render(<Landing />);

    expect(screen.getByText(/気温/)).toBeInTheDocument();
  });
});
