import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/router";
import { AdminSidebar } from "./AdminSidebar";
import { AdminTopbar } from "./AdminTopbar";
import { getWebApi } from "../../lib/api";

type AccessState = "checking" | "allowed" | "denied";

export function AdminShell({
  children,
  schoolName,
  userName,
  roleLabel,
  onSignOut,
}: {
  children: ReactNode;
  schoolName?: string;
  userName?: string;
  roleLabel?: string;
  onSignOut?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [access, setAccess] = useState<AccessState>("checking");
  const [sessionSchoolName, setSessionSchoolName] = useState(schoolName);
  const [sessionUserName, setSessionUserName] = useState(userName);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let active = true;

    async function verifySession() {
      try {
        const result = await getWebApi().auth.getSession();
        if (!active) return;
        if (!result.ok || !result.data?.activeSchool) {
          setAccess("denied");
          await router.replace("/signin");
          return;
        }

        const membership = result.data.memberships.find(
          (item) =>
            item.schoolId === result.data?.activeSchool?.id &&
            item.active,
        );
        if (!membership || membership.role !== "school_admin") {
          setAccess("denied");
          await getWebApi().auth.signOut();
          await router.replace("/signin");
          return;
        }

        setSessionSchoolName(result.data.activeSchool.name);
        setSessionUserName(result.data.user.fullName);
        setAccess("allowed");
      } catch {
        if (active) {
          setAccess("denied");
          await router.replace("/signin");
        }
      }
    }

    void verifySession();
    return () => {
      active = false;
    };
  }, [router]);

  async function handleSignOut() {
    try {
      await getWebApi().auth.signOut();
    } finally {
      await router.replace("/signin");
      onSignOut?.();
    }
  }

  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => {
    if (!drawerOpen) return;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const drawer = document.querySelector<HTMLElement>(
      "[data-admin-mobile-sidebar]",
    );
    const getFocusable = () =>
      drawer
        ? Array.from(
            drawer.querySelectorAll<HTMLElement>(
              'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
            ),
          ).filter((element) => element.offsetParent !== null)
        : [];
    getFocusable()[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setDrawerOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      const target = previouslyFocused?.isConnected
        ? previouslyFocused
        : menuButtonRef.current;
      target?.focus();
    };
  }, [drawerOpen]);

  if (access !== "allowed") {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-canvas px-6 text-ink"
        role="status"
        aria-live="polite"
      >
        <p className="text-sm font-medium">
          {access === "checking"
            ? "Verifying your secure school session…"
            : "Redirecting to sign in…"}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <AdminSidebar
        schoolName={sessionSchoolName}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
      <div className="min-h-screen lg:pl-[264px]">
        <AdminTopbar
          userName={sessionUserName}
          roleLabel={roleLabel ?? "School administrator"}
          menuButtonRef={menuButtonRef}
          onMenu={() => setDrawerOpen(true)}
          onSignOut={handleSignOut}
        />
        <main className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
