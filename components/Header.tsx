import React from 'react';

interface HeaderProps {
  title: string;
  description: string;
}

const Header: React.FC<HeaderProps> = ({ title, description }) => {
  return (
    <header className='mb-10 md:mb-16'>
      <h1 className='text-3xl font-bold underline leading-relaxed text-center'>
        {title}
      </h1>
      <p>{description}</p>
    </header>
  );
};

export default Header;
