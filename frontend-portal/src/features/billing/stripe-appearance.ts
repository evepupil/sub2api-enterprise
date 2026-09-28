import type { Appearance } from '@stripe/stripe-js';

export function readStripeAppearance(element: HTMLElement | null): Appearance {
  const computed = element === null ? null : window.getComputedStyle(element);
  const variables: NonNullable<Appearance['variables']> = {};
  const bindings = [
    ['colorPrimary', '--primary'],
    ['colorBackground', '--card'],
    ['colorText', '--foreground'],
    ['colorDanger', '--destructive'],
    ['fontFamily', '--font-family-sans'],
    ['borderRadius', '--control-radius'],
  ] as const;

  for (const [key, property] of bindings) {
    const value = computed?.getPropertyValue(property).trim();
    if (value) variables[key] = value;
  }

  return {
    theme: document.documentElement.dataset.theme === 'light' ? 'stripe' : 'night',
    variables,
  };
}
