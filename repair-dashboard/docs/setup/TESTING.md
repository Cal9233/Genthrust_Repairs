# Testing Guide

This project uses **Vitest** and **React Testing Library** for unit and integration testing.

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (re-runs on file changes)
npm test

# Run tests with UI
npm test:ui

# Run tests with coverage report
npm test:coverage
```

## Test Structure

### Test Files Location
- Tests are colocated with the source files
- Test files use the `.test.ts` or `.test.tsx` extension
- Example: `ROTable.tsx` has tests in `ROTable.test.tsx`

### Test Utilities
Located in `src/test/`:
- `setup.ts` - Global test setup and configurations
- `test-utils.tsx` - Custom render function with providers (React Query, etc.)
- `mocks.ts` - Reusable mock data (repair orders, shops, etc.)

## Writing Tests

### Unit Tests

Unit tests focus on testing individual functions or components in isolation:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '../test/test-utils';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('renders received status correctly', () => {
    render(<StatusBadge status="RECEIVED" isOverdue={false} />);
    expect(screen.getByText('RECEIVED')).toBeInTheDocument();
  });
});
```

### Integration Tests

Integration tests verify that multiple components work together:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../test/test-utils';
import { ROTable } from './ROTable';
import * as useROsModule from '../hooks/useROs';

// Mock the hooks
vi.mock('../hooks/useROs');

describe('ROTable Integration Tests', () => {
  beforeEach(() => {
    vi.mocked(useROsModule.useROs).mockReturnValue({
      data: mockRepairOrders,
      isLoading: false,
    } as any);
  });

  it('renders repair orders table', async () => {
    render(<ROTable />);

    await waitFor(() => {
      expect(screen.getByText('RO-001')).toBeInTheDocument();
    });
  });
});
```

## Mocking

### Mocking Hooks
```typescript
vi.mock('../hooks/useROs');

vi.mocked(useROsModule.useROs).mockReturnValue({
  data: mockRepairOrders,
  isLoading: false,
} as any);
```

### Using Mock Data
```typescript
import { mockRepairOrders, mockShops } from '../test/mocks';

// Use in your tests
render(<ROTable ros={mockRepairOrders} />);
```

## Best Practices

1. **Use descriptive test names** - Describe what the test does
2. **Arrange, Act, Assert** - Structure your tests clearly
3. **Test user behavior** - Focus on how users interact with components
4. **Mock external dependencies** - Isolate the code under test
5. **Use waitFor for async operations** - Handle async state updates properly

## Common Patterns

### Testing User Interactions
```typescript
const { user } = render(<MyComponent />);
const button = screen.getByRole('button', { name: 'Submit' });
await user.click(button);
```

### Testing Async Data Loading
```typescript
render(<MyComponent />);

await waitFor(() => {
  expect(screen.getByText('Data loaded')).toBeInTheDocument();
});
```

### Testing Forms
```typescript
const { user } = render(<MyForm />);
const input = screen.getByLabelText('Name');
await user.type(input, 'John Doe');

const submitButton = screen.getByRole('button', { name: 'Submit' });
await user.click(submitButton);

expect(mockOnSubmit).toHaveBeenCalledWith({ name: 'John Doe' });
```

## Troubleshooting

### Tests failing due to missing mocks
Make sure all hooks and external dependencies are mocked in your test setup.

### Async tests timing out
Use `waitFor` for operations that involve state updates or API calls.

### Console errors in tests
Check that all required providers are included in the test-utils render function.

## Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Library User Event](https://testing-library.com/docs/user-event/intro)
