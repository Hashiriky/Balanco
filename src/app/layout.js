import { Inter } from 'next/font/google';
import Shell from '@/components/Shell.jsx';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata = {
  title: { default: 'Balanço · Finanças pessoais', template: '%s · Balanço' },
  description: 'Contas, lançamentos, cartões, agenda de pagamentos, orçamento e relatórios.',
  applicationName: 'Balanço',
};
export const viewport = { themeColor: '#ffffff', width: 'device-width', initialScale: 1, colorScheme: 'light' };

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body>
        <a className="skip" href="#main">Pular para o conteúdo</a>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
