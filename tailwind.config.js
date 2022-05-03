module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}",],
  theme: {
    extend: {
      fontFamily: {
        display: ['Gotham Narrow', 'Helvetica', 'Arial', 'sans-serif'],
        sans: ['Gotham Narrow', 'Helvetica', 'Arial', 'sans-serif'],
        body: ['Gotham Narrow', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['Courier', 'monospace'],
      },
      colors: {
        guilded: {
          // https://www.guilded.gg/brand
          gray: '#36363D',
          black: '#111820',
          gilded: '#F5C400',
          // misc. solid colors
          slate: '#292B32',
          // text
          white: '#ececee',  // chat messages
          subtitle: '#a3a3ac',  // server settings
          link: '#ffeca0',
        },
      },
    },
  },
  plugins: [],
}
