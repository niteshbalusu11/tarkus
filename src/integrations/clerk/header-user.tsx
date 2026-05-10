import {
  SignedIn,
  SignInButton,
  SignedOut,
  UserButton,
} from '@clerk/clerk-react'
import { Button } from '../../components/ui/button'

export default function HeaderUser() {
  return (
    <>
      <SignedIn>
        <UserButton />
      </SignedIn>
      <SignedOut>
        <SignInButton>
          <Button type="button" variant="ghost">
            Sign in
          </Button>
        </SignInButton>
      </SignedOut>
    </>
  )
}
