import { Separator } from '@/components/ui/separator'
import { Link } from 'react-router'

import Logo from '@/assets/logo.png'

import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'

import GithubWhite from '@/assets/github/white.svg'
import GithubBlack from '@/assets/github/black.svg'

const Footer = ({ className }: { className?: string }) => {
	const { theme } = useTheme()
  return (
    <footer className={cn(className)}>
      <div className='mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 max-md:flex-col sm:px-6 sm:py-6 md:gap-6 md:py-8'>
        <Link to='/'>
          <div className='flex items-center gap-3'>
            <img src={Logo} alt='Logo' className='h-8 w-auto' />
          </div>
        </Link>

        <div className='flex items-center gap-5 whitespace-nowrap'>
          <Link to='/about' className='opacity-80 transition-opacity duration-300 hover:opacity-100'>
            About
          </Link>
          <Link to='/features' className='opacity-80 transition-opacity duration-300 hover:opacity-100'>
            Features
          </Link>
        </div>

        <div className='flex items-center gap-4'>
          <a href='#'>
            {theme === 'dark' ? (
              <img src={GithubWhite} alt='Github' className='h-6 w-auto' />
            ) : (
              <img src={GithubBlack} alt='Github' className='h-6 w-auto' />
            )}
          </a>
        </div>
      </div>

      <Separator />

      <div className='mx-auto flex max-w-7xl justify-center px-4 py-8 sm:px-6'>
        <p className='text-center font-medium text-balance'>
          {`©${new Date().getFullYear()}`}{' '}
          <a href='https://github.com/Im345' className='hover:underline'>
            Im345
          </a>
        </p>
      </div>
    </footer>
  )
}

export default Footer
