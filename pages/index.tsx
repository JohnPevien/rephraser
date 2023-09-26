import { useState } from 'react';
import { Inter } from 'next/font/google';
import { TextField, Button, Select } from '@/components/form';
import { Card } from '@/components/suggestion';
import { Toaster, toast } from 'react-hot-toast';
import { AiFillGithub, AiOutlineTwitter } from 'react-icons/ai';
import Head from 'next/head';

const inter = Inter({ subsets: ['latin'] });

function cleanUpString(str: string) {
  // Remove leading and trailing spaces, newlines, and tabs
  str = str.trim().replace(/[\n\t]/g, '');
  // Remove extra spaces between words
  str = str.replace(/\s+/g, ' ');
  str = str.toLowerCase();

  return str;
}

export default function Home() {
  const [sentence, setSentence] = useState('');
  const [vibe, setVibe] = useState('casual');
  const [rephrasedSentences, setRephrasedSentences] = useState('');
  const [loading, setLoading] = useState(false);
  const [correctGrammar, setCorrectGrammar] = useState(true);
  const [suggestedSentence, setSuggestedSentence] = useState('');

  const generateSentence = async (sentence: string, vibe: string) => {
    setLoading(true);
    setCorrectGrammar(true);
    setSuggestedSentence('');
    sentence = cleanUpString(sentence);

    setRephrasedSentences('');

    const grammarCheck = await checkGrammar(sentence);
    const isGrammaticallyCorrect = grammarCheck?.grammarCheck === 'true';
    const suggestedSentence = grammarCheck?.suggestedSentence;

    if (!isGrammaticallyCorrect) {
      setCorrectGrammar(false);
      setSuggestedSentence(suggestedSentence || '');
    }

    const response = await fetch('/api/generate', {
      method: 'POST',
      body: JSON.stringify({
        sentence,
        vibe,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      toast('An error occured, please try again.', {
        icon: '⛔',
      });
      setLoading(false);
      return;
      // throw new Error(response.statusText);
    }
    const data = response.body;
    if (!data) return;
    const reader = data.getReader();
    const decoder = new TextDecoder();
    let done = false;

    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      const chunkValue = decoder.decode(value);
      setRephrasedSentences((prev) => prev + chunkValue);
    }

    setLoading(false);
  };

  const tryAgain = () => {
    setSentence('');
    setRephrasedSentences('');
    setCorrectGrammar(true);
    setSuggestedSentence('');
  };

  const checkGrammar = async (sentence: string) => {
    const response = await fetch('/api/checkgrammar', {
      method: 'POST',
      body: JSON.stringify({
        sentence,
        vibe,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      toast('An error occured, please try again.', {
        icon: '⛔',
      });
      setLoading(false);
      return;
      // throw new Error(response.statusText);
    }
    const data = response.body;
    if (!data) return;
    const reader = data.getReader();
    const decoder = new TextDecoder();
    let done = false;
    let text = '';

    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      const chunkValue = decoder.decode(value);
      text += chunkValue;
    }

    // Find the index of the newline character (\n) to split the string
    const newlineIndex = text.indexOf('\n');

    // Extract the substrings before and after the newline character
    const grammarCheckString = text.substring(0, newlineIndex);
    const suggestedSentenceString = text.substring(newlineIndex + 1);

    // Remove the leading and trailing spaces from the extracted substrings
    const grammarCheck = grammarCheckString
      .toLowerCase()
      .replace('grammarcheck:', '')
      .replace(/"/g, '')
      .trim();
    const suggestedSentence = suggestedSentenceString
      .replace('suggestedsentence:', '')
      .replace(/"/g, '')
      .trim();

    return { grammarCheck, suggestedSentence };
  };

  return (
    <>
      <Head>
        <title>Rephraser</title>
      </Head>
      <main
        className={`flex  flex-col items-center min-h-[90vh] justify-start ${inter.className}`}
      >
        <Toaster
          position='top-center'
          reverseOrder={false}
          toastOptions={{ duration: 2000 }}
        />
        <div className='bg-neutral w-full h-10 md:h-20 mb-10'></div>
        <div className='max-w-prose px-8 md:px-0'>
          <div className='flex  flex-col items-center justify-start py-2'>
            <header className='mb-10 md:mb-16'>
              <h1 className='text-3xl font-bold underline leading-relaxed text-center'>
                Rephraser
              </h1>
              <p>A rephraser and grammar checker app powered by OpenAI API.</p>
            </header>
            <div className='w-full flex flex-col gap-5'>
              <div>
                <TextField
                  className='rounded border-2 border-neutral w-full max-w-full'
                  onChange={(e) => {
                    setSentence(e.target.value);
                  }}
                  value={sentence}
                />

                {!correctGrammar && (
                  <>
                    <p className={`text-sm mt-2 `}>Suggested Sentence:</p>
                    <p className='text-xs text-gray-500 mt-2'>
                      {`${suggestedSentence}`}
                    </p>
                  </>
                )}
              </div>
              <div className='flex flex-col sm:flex-row justify-between gap-5 items-center'>
                <p>Select tone:</p>
                <Select
                  className='rounded w-full max-w-full sm:max-w-xs'
                  onChange={(e) => setVibe(e.target.value)}
                  value={vibe}
                  options={[
                    'Professional',
                    'Conversational',
                    'Humorous',
                    'Empatic',
                    'Academic',
                    'Simple',
                    'Creative',
                  ]}
                />
              </div>
              {!rephrasedSentences ? (
                <Button
                  onClick={() => generateSentence(sentence, vibe)}
                  disabled={loading || !sentence || sentence.length < 7}
                >
                  Rephrase
                </Button>
              ) : (
                <Button onClick={tryAgain}>Try again</Button>
              )}

              <p className='text-xs text-center'></p>
            </div>

            <div className='w-full mt-10'>
              {rephrasedSentences && (
                <>
                  <hr />
                  <h3 className='text-center text-xl mt-3 mb-5 font-semibold'>
                    Rephrased Sentences
                  </h3>
                  {rephrasedSentences.split('\n').map((sentence, index) => {
                    if (sentence.length < 7) return;
                    sentence = sentence
                      .replace('- ', '')
                      .replace(/^\d+\.\s/gm, '')
                      .replace(/"/g, '')
                      .trim();
                    return (
                      <Card
                        text={sentence}
                        key={index}
                        className='text-center w-full mb-5'
                        onClick={() => {
                          navigator.clipboard.writeText(sentence);
                          toast('Sentence have been copied to clipboard', {
                            icon: '✂️',
                          });
                        }}
                      />
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </div>
      </main>
      <footer className='container mx-auto max-w-prose'>
        <hr className='mb-5' />
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
              href='https://github.com/JohnPevien/rephraser
            '
              rel='noreferrer'
            >
              <AiFillGithub size={'2em'} />
            </a>
            <a
              href='https://twitter.com/JohnPevien
            '
              rel='noreferrer'
            >
              <AiOutlineTwitter size={'2em'} />
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
