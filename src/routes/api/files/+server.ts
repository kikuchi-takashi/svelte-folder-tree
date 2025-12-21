import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  const data = await request.json();
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Mock response
  return json({
    success: true,
    message: `${data.type} "${data.name}" created successfully`,
    data
  });
};

export const DELETE: RequestHandler = async ({ request }) => {
  const data = await request.json();
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Mock response
  return json({
    success: true,
    message: `Item "${data.id}" deleted successfully`,
    data
  });
};
