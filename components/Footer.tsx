import React from 'react';
import { AiFillGithub, AiOutlineTwitter } from 'react-icons/ai';

const Footer: React.FC = () => {
  return (
    <footer className='container mx-auto max-w-prose'>
      <p className='text-center text-sm text-gray-400'>
        This app uses ChatGPT and may produce inaccurate results
      </p>
      <hr className='mb-5 mt-2' />
      <div className='flex flex-row justify-between items-center mb-8'>
        <div>
          <p>
            Powered by{' '}
            <a
              href='https://openai.com/blog/chatgpt'
              className='underline'
              rel='noreferrer'
            >
              OpenAI
            </a>{' '}
            and{' '}
            <a
              href='https://vercel.com/'
              className='underline'
              rel='noreferrer'
            >
              Vercel
            </a>
          </p>
        </div>
        <div className='flex flex-row gap-3'>
          <a
            href='https://github.com/JohnPevien/rephraser'
            rel='noreferrer'
            title='View source code on GitHub'
          >
            <AiFillGithub size={'2em'} />
          </a>
          <a
            href='https://twitter.com/JohnPevien'
            rel='noreferrer'
            title='Follow me on Twitter'
          >
            <AiOutlineTwitter size={'2em'} />
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
