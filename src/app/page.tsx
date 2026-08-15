"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import AmbientField from "@/components/AmbientField";
import AuthModal from "@/components/AuthModal";
import ChatArea from "@/components/ChatArea";
import CommandPalette from "@/components/CommandPalette";
import Sidebar from "@/components/Sidebar";
import SystemPromptModal from "@/components/SystemPromptModal";
import TitleBar from "@/components/TitleBar";
import { useStore } from "@/lib/store";

export default function Home() {
  const { hydrated, newChat, authState } = useStore();

  // The sidebar stays out of the way by default; the palette (⌘K) is the
  // primary way to move around.
  const [sidebar, setSidebar] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  const [keyModal, setKeyModal] = useState(false);
  const [keyPromptDismissed, setKeyPromptDismissed] = useState(false);
  const [systemModal, setSystemModal] = useState(false);

  // Surface the setup dialog automatically once the probe reports no usable
  // profile — derived, so no effect is needed.
  const needsSetup =
    authState === "cli-missing" ||
    authState === "logged-out" ||
    authState === "error";
  const showKeyModal = keyModal || (hydrated && needsSetup && !keyPromptDismissed);

  const closeKeyModal = useCallback(() => {
    setKeyModal(false);
    setKeyPromptDismissed(true);
  }, []);

  const toggleSidebar = useCallback(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      setSidebar((v) => !v);
    } else {
      setDrawer((v) => !v);
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();

      if (e.shiftKey) {
        switch (key) {
          case "o":
            e.preventDefault();
            newChat();
            setDrawer(false);
            return;
          case "k":
            e.preventDefault();
            setKeyModal(true);
            return;
          case "p":
            e.preventDefault();
            setSystemModal(true);
            return;
          default:
            return;
        }
      }

      if (key === "k") {
        e.preventDefault();
        setPalette((v) => !v);
      } else if (key === "b") {
        e.preventDefault();
        toggleSidebar();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newChat, toggleSidebar]);

  if (!hydrated) {
    return (
      <div className="flex h-dvh items-center justify-center bg-black">
        <div className="size-5 animate-spin rounded-full border-2 border-zinc-800 border-t-amber-500" />
      </div>
    );
  }

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden">
      {/* Ambient field: a full-viewport layer that reacts to the model's phase.
          The document body is already black, so nothing opaque sits over it. */}
      <AmbientField />

      <div className="relative z-10 flex h-full flex-col">
        <TitleBar />

        <div className="flex min-h-0 flex-1">
          {/* Desktop rail */}
          <motion.aside
            initial={false}
            animate={{ width: sidebar ? 288 : 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="hidden shrink-0 overflow-hidden lg:block"
          >
            <div className="h-full w-72">
              <Sidebar
                onCollapse={() => setSidebar(false)}
                onOpenKey={() => setKeyModal(true)}
                onOpenSystem={() => setSystemModal(true)}
              />
            </div>
          </motion.aside>

          {/* Mobile drawer */}
          <AnimatePresence>
            {drawer && (
              <div className="fixed inset-0 z-40 lg:hidden">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => setDrawer(false)}
                  className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                />
                <motion.div
                  initial={{ x: "-100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "-100%" }}
                  transition={{ type: "spring", stiffness: 380, damping: 36 }}
                  className="absolute inset-y-0 left-0 w-[85%] max-w-xs shadow-2xl shadow-black/80"
                >
                  <Sidebar
                    onClose={() => setDrawer(false)}
                    onOpenKey={() => {
                      setDrawer(false);
                      setKeyModal(true);
                    }}
                    onOpenSystem={() => {
                      setDrawer(false);
                      setSystemModal(true);
                    }}
                  />
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <ChatArea
            onToggleSidebar={toggleSidebar}
            sidebarOpen={sidebar}
            onOpenPalette={() => setPalette(true)}
            onNeedKey={() => setKeyModal(true)}
          />
        </div>
      </div>

      <CommandPalette
        open={palette}
        onClose={() => setPalette(false)}
        onOpenKey={() => setKeyModal(true)}
        onOpenSystem={() => setSystemModal(true)}
        onToggleSidebar={toggleSidebar}
      />
      <AuthModal open={showKeyModal} onClose={closeKeyModal} />
      <SystemPromptModal open={systemModal} onClose={() => setSystemModal(false)} />
    </div>
  );
}
