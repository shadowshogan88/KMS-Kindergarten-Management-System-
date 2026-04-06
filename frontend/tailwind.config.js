import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';
import preline from 'preline/plugin';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6',
        'default-500': '#6b7280',
        'default-800': '#1f2937',
        'default-200': '#e5e7eb',
      },
    },
  },
  plugins: [forms, typography, preline],
};
