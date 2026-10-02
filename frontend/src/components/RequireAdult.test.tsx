import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RequireAdult } from './RequireAdult';
const mocks=vi.hoisted(()=>({status:vi.fn()}));
vi.mock('../api/client',()=>({authAPI:{adultAccountStatus:mocks.status}}));
vi.mock('../hooks/store',()=>({useAuthStore:(selector:any)=>selector({token:'existing-jwt',user:{is_verified:true,verified_age_18_plus:true}})}));
function show(){render(<MemoryRouter><Routes><Route path="/" element={<RequireAdult><p>Protected content</p></RequireAdult>}/><Route path="/age-assurance" element={<p>Age recovery</p>}/></Routes></MemoryRouter>);}
describe('RequireAdult',()=>{
  beforeEach(()=>vi.resetAllMocks());
  it('does not trust cached age or ID flags',async()=>{
    mocks.status.mockResolvedValue({data:{assured:false}});show();
    await waitFor(()=>expect(screen.getByText('Age recovery')).toBeInTheDocument());
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });
  it('fails closed on server failure',async()=>{
    mocks.status.mockRejectedValue(new Error('offline'));show();
    await waitFor(()=>expect(screen.getByText('Age recovery')).toBeInTheDocument());
  });
  it('renders protected content only after server evidence',async()=>{
    mocks.status.mockResolvedValue({data:{assured:true}});show();
    await waitFor(()=>expect(screen.getByText('Protected content')).toBeInTheDocument());
  });
});
