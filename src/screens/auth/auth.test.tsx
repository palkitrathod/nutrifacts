import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { AuthProvider } from '../../auth/AuthContext';
import { NutritionProvider } from '../../context/NutritionContext';
import { AppRoutes } from '../../App';
import { INITIAL_PACKAGES } from '../../data/mockData';

type Handler = (body: any) => { status: number; body?: unknown };

const activePackages = INITIAL_PACKAGES.filter((p) => p.isActive);
// The app data a freshly signed-up patient gets: just the price list.
const emptyData = {
  patients: [], dietCharts: [], weightRecords: [], appointments: [], notifications: [],
  dailyTrackers: {}, packages: INITIAL_PACKAGES, payments: [], adherenceRecords: [],
};
const defaultHandlers: Record<string, Handler> = {
  'GET /packages': () => ({ status: 200, body: { packages: activePackages } }),
  'GET /data': () => ({ status: 200, body: emptyData }),
  'POST /data/batch': (b) => ({ status: 200, body: { saved: b.ops.length } }),
};

/** Minimal fake of the auth API: routes "/api/..." calls to handlers. */
function mockApi(handlers: Record<string, Handler>) {
  const calls: Array<{ path: string; body: any }> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = url.replace(/^\/api/, '');
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      calls.push({ path, body });
      const handler = handlers[`${init?.method ?? 'GET'} ${path}`] ?? defaultHandlers[`${init?.method ?? 'GET'} ${path}`];
      const result = handler ? handler(body) : { status: 404, body: { error: { code: 'not_found', message: 'Not found.' } } };
      return new Response(result.status === 204 ? null : JSON.stringify(result.body ?? {}), {
        status: result.status,
        headers: { 'Content-Type': 'application/json' },
      });
    })
  );
  return calls;
}

const anonymous: Handler = () => ({ status: 401, body: { error: { code: 'unauthenticated', message: 'You are not signed in.' } } });
const priya = { id: 'patient-priya', name: 'Priya Sharma', email: 'priya.sharma@example.com', phone: '+919876543210', role: 'patient', createdAt: '', emailVerified: true };
/** Signed up but hasn't entered the emailed code yet. */
const unverified = { ...priya, id: 'patient-pending', emailVerified: false };

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname + loc.search}</div>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <NutritionProvider>
          <AppRoutes />
          <LocationProbe />
        </NutritionProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

const location = () => screen.getByTestId('location').textContent;

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  // jsdom has no layout engine
  Element.prototype.scrollIntoView = vi.fn();
  window.scrollTo = vi.fn() as any;
});

describe('home page', () => {
  it('"Sign In" and "Get Started" go to different pages', async () => {
    mockApi({ 'GET /auth/me': anonymous });
    renderAt('/');
    const signInLinks = await screen.findAllByRole('link', { name: 'Sign In' });
    const getStartedLinks = screen.getAllByRole('link', { name: 'Get Started' });
    signInLinks.forEach((l) => expect(l).toHaveAttribute('href', '/signin'));
    getStartedLinks.forEach((l) => expect(l).toHaveAttribute('href', '/signup'));
  });

  it('pricing cards carry the chosen plan to sign-up', async () => {
    mockApi({ 'GET /auth/me': anonymous });
    renderAt('/');
    const planLinks = await screen.findAllByRole('link', { name: /choose this plan/i });
    expect(planLinks[0].getAttribute('href')).toMatch(/^\/signup\?plan=/);
  });

  it('shows "Open my dashboard" instead of sign-in buttons when signed in', async () => {
    mockApi({ 'GET /auth/me': () => ({ status: 200, body: { user: priya } }) });
    renderAt('/');
    expect((await screen.findAllByRole('link', { name: /open my dashboard/i }))[0]).toHaveAttribute('href', '/app');
    expect(screen.queryByRole('link', { name: 'Sign In' })).not.toBeInTheDocument();
  });

  it('offers no dashboard to someone who signed up but has not verified their email', async () => {
    mockApi({ 'GET /auth/me': () => ({ status: 200, body: { user: unverified } }) });
    renderAt('/');
    expect((await screen.findAllByRole('link', { name: 'Sign In' }))[0]).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /open my dashboard/i })).not.toBeInTheDocument();
  });
});

describe('route guards', () => {
  it('sends signed-out visitors of /app to sign-in, remembering where they were going', async () => {
    mockApi({ 'GET /auth/me': anonymous });
    renderAt('/app');
    await waitFor(() => expect(location()).toBe('/signin?next=%2Fapp'));
  });

  it('sends signed-in users away from the sign-in page', async () => {
    mockApi({ 'GET /auth/me': () => ({ status: 200, body: { user: priya } }) });
    renderAt('/signin');
    await waitFor(() => expect(location()).toBe('/app'));
  });

  it('lets an unverified account use the sign-in and sign-up pages', async () => {
    mockApi({ 'GET /auth/me': () => ({ status: 200, body: { user: unverified } }) });
    renderAt('/signup');
    expect(await screen.findByRole('heading', { name: 'Create your account' })).toBeInTheDocument();
    expect(location()).toBe('/signup');
  });

  it('sends an unverified account from the app to the code screen', async () => {
    mockApi({ 'GET /auth/me': () => ({ status: 200, body: { user: unverified } }) });
    renderAt('/app');
    await waitFor(() => expect(location()).toBe('/verify-email?next=%2Fapp'));
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
  });

  it('shows a 404 page for unknown URLs', async () => {
    mockApi({ 'GET /auth/me': anonymous });
    renderAt('/does-not-exist');
    expect(await screen.findByRole('heading', { name: /doesn't exist/i })).toBeInTheDocument();
  });
});

describe('sign-in page', () => {
  it('validates before calling the API', async () => {
    const calls = mockApi({ 'GET /auth/me': anonymous });
    renderAt('/signin');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /^sign in$/i }));
    expect(screen.getByText('Enter your email address.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toHaveFocus();
    expect(calls.filter((c) => c.path === '/auth/signin')).toHaveLength(0);
  });

  it('shows the server error, clears the password and keeps the email', async () => {
    mockApi({
      'GET /auth/me': anonymous,
      'POST /auth/signin': () => ({ status: 401, body: { error: { code: 'invalid_credentials', message: 'Incorrect email or password.' } } }),
    });
    renderAt('/signin');
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Email address'), 'priya.sharma@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-pass1');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(await screen.findByText('Incorrect email or password.')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(screen.getByLabelText('Email address')).toHaveValue('priya.sharma@example.com');
  });

  it('signs in and returns to the "next" page', async () => {
    const calls = mockApi({
      'GET /auth/me': anonymous,
      'POST /auth/signin': () => ({ status: 200, body: { user: priya } }),
    });
    renderAt('/signin?next=%2Fapp%3Ftab%3Ddiet');
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Email address'), 'priya.sharma@example.com');
    await user.type(screen.getByLabelText('Password'), 'Demo@1234');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() => expect(location()).toBe('/app?tab=diet'));
    expect(calls.find((c) => c.path === '/auth/signin')!.body).toEqual({
      email: 'priya.sharma@example.com',
      password: 'Demo@1234',
      remember: true,
    });
  });

  it('ignores an off-site "next" (open-redirect protection)', async () => {
    mockApi({ 'GET /auth/me': anonymous, 'POST /auth/signin': () => ({ status: 200, body: { user: priya } }) });
    renderAt('/signin?next=%2F%2Fevil.example');
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Email address'), 'priya.sharma@example.com');
    await user.type(screen.getByLabelText('Password'), 'Demo@1234');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));
    await waitFor(() => expect(location()).toBe('/app'));
  });

  it('password visibility can be toggled', async () => {
    mockApi({ 'GET /auth/me': anonymous });
    renderAt('/signin');
    const user = userEvent.setup();
    const pwd = await screen.findByLabelText('Password');
    expect(pwd).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(pwd).toHaveAttribute('type', 'text');
  });
});

describe('sign-up page', () => {
  async function fillValid(user: ReturnType<typeof userEvent.setup>) {
    await user.type(await screen.findByLabelText('Full name'), 'Meera Iyer');
    await user.type(screen.getByLabelText('Email address'), 'meera@example.com');
    await user.type(screen.getByLabelText('Mobile number (WhatsApp)'), '9876543210');
    await user.type(screen.getByLabelText('Password'), 'Healthy123');
    await user.type(screen.getByLabelText('Confirm password'), 'Healthy123');
    await user.click(screen.getByRole('checkbox', { name: /i agree/i }));
  }

  it('shows all field errors on an empty submit and focuses the first', async () => {
    const calls = mockApi({ 'GET /auth/me': anonymous });
    renderAt('/signup');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /create account/i }));

    expect(screen.getByText('Enter your full name.')).toBeInTheDocument();
    expect(screen.getByText('Enter your email address.')).toBeInTheDocument();
    expect(screen.getByText(/enter your mobile number/i)).toBeInTheDocument();
    expect(screen.getByText('Create a password.')).toBeInTheDocument();
    expect(screen.getByText('Please accept to continue.')).toBeInTheDocument();
    expect(screen.getByLabelText('Full name')).toHaveFocus();
    expect(calls.filter((c) => c.path === '/auth/signup')).toHaveLength(0);
  });

  it('catches mismatched passwords', async () => {
    mockApi({ 'GET /auth/me': anonymous });
    renderAt('/signup');
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Password'), 'Healthy123');
    await user.type(screen.getByLabelText('Confirm password'), 'Healthy124');
    await user.tab();
    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
  });

  it('shows "email taken" from the server against the email field with a sign-in link', async () => {
    mockApi({
      'GET /auth/me': anonymous,
      'POST /auth/signup': () => ({
        status: 409,
        body: { error: { code: 'email_taken', message: 'x', fields: { email: 'An account with this email already exists. Sign in instead?' } } },
      }),
    });
    renderAt('/signup');
    const user = userEvent.setup();
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText(/already has an account/i)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Sign in' })[0]).toHaveAttribute('href', '/signin');
    expect(screen.getByLabelText('Email address')).toHaveFocus();
  });

  it('creates the account and opens the app as the new patient', async () => {
    const meera = { ...priya, id: 'patient-new', name: 'Meera Iyer', email: 'meera@example.com' };
    const calls = mockApi({
      'GET /auth/me': anonymous,
      'POST /auth/signup': () => ({ status: 201, body: { user: meera } }),
    });
    renderAt('/signup');
    const user = userEvent.setup();
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => expect(location()).toBe('/app'));
    expect(calls.find((c) => c.path === '/auth/signup')!.body).toEqual({
      name: 'Meera Iyer',
      email: 'meera@example.com',
      phone: '9876543210',
      password: 'Healthy123',
      acceptedTerms: true,
      remember: true,
    });
    expect((await screen.findAllByText(/Meera/)).length).toBeGreaterThan(0);

    // The new patient's profile is created on the server by the first auto-save.
    await waitFor(() => expect(calls.some((c) => c.path === '/data/batch')).toBe(true));
    const ops = calls.filter((c) => c.path === '/data/batch').flatMap((c) => c.body.ops);
    expect(ops).toContainEqual(expect.objectContaining({ collection: 'patients', id: 'patient-new' }));
  });

  it('shows the plan picked on the home page', async () => {
    mockApi({ 'GET /auth/me': anonymous });
    const plan = activePackages[0];
    renderAt(`/signup?plan=${plan.id}`);
    expect(await screen.findByText(/selected plan/i)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(plan.title))).toBeInTheDocument();
  });

  it('shows a network error without losing what was typed', async () => {
    mockApi({ 'GET /auth/me': anonymous });
    renderAt('/signup');
    const user = userEvent.setup();
    await fillValid(user);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not reach nutrifacts/i);
    expect(screen.getByLabelText('Full name')).toHaveValue('Meera Iyer');
  });
});
