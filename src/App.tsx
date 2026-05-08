import { useState } from 'react';
import { greet } from './lib/greet';

export default function App() {
  const [name, setName] = useState('IITC');

  return (
    <main>
      <h1>{greet(name)}</h1>
      <p>Lab 14 — Deploy a Vite + React + TypeScript app to S3.</p>
      <label>
        Your name:{' '}
        <input
          aria-label="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
    </main>
  );
}
