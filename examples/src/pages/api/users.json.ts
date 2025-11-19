export const GET = () => {
  return new Response(
    JSON.stringify({
      '123': { name: 'Alice' },
      '456': { name: 'Bob' },
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
};
