import { renderHook, act } from '@testing-library/react';
import useLocalStorage from '../../hooks/useLocalStorage';

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns the initial value when key is not set', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'default'));
    expect(result.current[0]).toBe('default');
  });

  it('persists value to localStorage', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', null));
    act(() => { result.current[1]('hello'); });
    expect(result.current[0]).toBe('hello');
    expect(JSON.parse(localStorage.getItem('test-key'))).toBe('hello');
  });

  it('removes item when value is null', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));
    act(() => { result.current[1](null); });
    expect(result.current[0]).toBeNull();
    expect(localStorage.getItem('test-key')).toBeNull();
  });
});
