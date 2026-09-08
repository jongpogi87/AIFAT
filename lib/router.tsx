import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";

export interface RouterContextType {
  pathname: string;
  search: string;
  params: Record<string, string>;
  push: (url: string) => void;
  replace: (url: string) => void;
  back: () => void;
}

const RouterContext = createContext<RouterContextType>({
  pathname: typeof window !== "undefined" ? window.location.pathname : "/",
  search: typeof window !== "undefined" ? window.location.search : "",
  params: {},
  push: () => {},
  replace: () => {},
  back: () => {},
});

export function useRouter() {
  const ctx = useContext(RouterContext);
  return {
    push: ctx.push,
    replace: ctx.replace,
    back: ctx.back,
  };
}

export function usePathname() {
  return useContext(RouterContext).pathname;
}

export function useParams() {
  return useContext(RouterContext).params;
}

export function Link({
  href,
  children,
  className,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const { push } = useRouter();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Only intercept internal links with standard left click and no modifier keys
    if (
      !e.defaultPrevented &&
      e.button === 0 &&
      (!props.target || props.target === "_self") &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.altKey &&
      !e.shiftKey &&
      href.startsWith("/")
    ) {
      e.preventDefault();
      push(href);
    }
  };

  return (
    <a href={href} onClick={handleClick} className={className} {...props}>
      {children}
    </a>
  );
}

import { matchRoute } from "./router-match.ts";
export { matchRoute };

export interface RouteConfig {
  pattern: string; // e.g. "/", "/admin", "/verify/:ref"
  component: React.ComponentType<any>;
}

export function RouterProvider({
  children,
  routes = [],
  fallback,
}: {
  children?: ReactNode;
  routes?: RouteConfig[];
  fallback?: React.ComponentType<any>;
}) {
  const [currentPath, setCurrentPath] = useState(() =>
    typeof window !== "undefined" ? window.location.pathname : "/"
  );
  const [currentSearch, setCurrentSearch] = useState(() =>
    typeof window !== "undefined" ? window.location.search : ""
  );

  useEffect(() => {
    const onPopState = () => {
      setCurrentPath(window.location.pathname);
      setCurrentSearch(window.location.search);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const push = useCallback((url: string) => {
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", url);
      const [path, search = ""] = url.split("?");
      setCurrentPath(path);
      setCurrentSearch(search ? `?${search}` : "");
      window.scrollTo(0, 0);
    }
  }, []);

  const replace = useCallback((url: string) => {
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", url);
      const [path, search = ""] = url.split("?");
      setCurrentPath(path);
      setCurrentSearch(search ? `?${search}` : "");
    }
  }, []);

  const back = useCallback(() => {
    if (typeof window !== "undefined") {
      window.history.back();
    }
  }, []);

  // Find matching route
  let matchedComponent: React.ComponentType<any> | null = null;
  let routeParams: Record<string, string> = {};

  for (const route of routes) {
    const res = matchRoute(route.pattern, currentPath);
    if (res.match) {
      matchedComponent = route.component;
      routeParams = res.params;
      break;
    }
  }

  const contextValue: RouterContextType = {
    pathname: currentPath,
    search: currentSearch,
    params: routeParams,
    push,
    replace,
    back,
  };

  const ComponentToRender = matchedComponent || fallback;

  return (
    <RouterContext.Provider value={contextValue}>
      {ComponentToRender ? <ComponentToRender params={routeParams} /> : children}
    </RouterContext.Provider>
  );
}
