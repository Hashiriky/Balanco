export default function manifest() {
  return { name: 'Balanço', short_name: 'Balanço', description: 'Finanças pessoais', start_url: '/', display: 'standalone', background_color: '#f5f6f8', theme_color: '#ffffff', lang: 'pt-BR',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }] };
}
