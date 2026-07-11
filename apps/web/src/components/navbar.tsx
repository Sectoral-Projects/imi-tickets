import { authClient } from "@/lib/auth-client";
import { signInWithDiscord } from "@/lib/auth";
import logo from "@/assets/logo.png";

import { Link } from "react-router";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { NavbarSkeleton } from "@/components/navbar-skeleton";
import { Menu, LogOut } from "lucide-react";
import { ThemeToggle } from "@/components/theme/toggle";

interface MenuItem {
  title: string;
  url: string;
  description?: string;
  icon?: React.ReactNode;
  items?: MenuItem[];
}

interface NavbarProps {
  logo: {
    url: string;
    src: string;
    alt: string;
    title: string;
    className?: string;
  };
  menu?: MenuItem[];
}

const data: NavbarProps = {
  logo: {
    url: "http://localhost:5173",
    src: logo,
    alt: "logo",
    title: "imi/tickets",
  },
  menu: [
    { title: "Tickets", url: "/" },
    {
      title: "Staff",
      url: "/staff",
    },
    {
      title: "Settings",
      url: "/settings",
    }
  ]
};

export function Navbar({ className }: { className?: string }) {
  const { data: auth, isPending } = authClient.useSession();

  if (isPending) {
    return <NavbarSkeleton />;
  }

  console.log(auth);

  if (!auth || !auth.user) {
    return (
      <div className="flex flex-row content-center justify-between max-h-12">
        <Link to="/" className="flex flex-row gap-3">
          <img src={logo} className="size-10" alt="imi/tickets" />
          <h2>imi/tickets</h2>
        </Link>
        <div className="flex flex-row gap-3">
          <ThemeToggle />
          <Button onClick={() => signInWithDiscord("/")}>
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <section className={cn("py-4", className)}>
      <div className="container">
        {/* Desktop Menu */}
        <nav className="hidden items-center justify-between lg:flex">
          <div className="flex items-center gap-6">
            {/* Logo */}
            <a href={data.logo.url} className="flex items-center gap-2">
              <img
                src={data.logo.src}
                className="max-h-8"
                alt={data.logo.alt}
              />
              <span className="text-lg font-semibold tracking-tighter">
                {data.logo.title}
              </span>
            </a>
            <div className="flex items-center">
              <NavigationMenu>
                <NavigationMenuList>
                  {data.menu?.map((item) => renderMenuItem(item))}
                </NavigationMenuList>
              </NavigationMenu>
            </div>
          </div>
          <div className="flex gap-2">
            <ThemeToggle />
            <Button variant="destructive"
              onClick={async () =>
                await authClient.signOut()
              }
            >
              <LogOut className="size-5" />
              Log Out
            </Button>
          </div>
        </nav>

        {/* Mobile Menu */}
        <div className="block lg:hidden">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <a href={data.logo.url} className="flex items-center gap-2">
              <img
                src={data.logo.src}
                className="max-h-8 dark:invert"
                alt={data.logo.alt}
              />
            </a>
            <Sheet>
              <SheetTrigger>
                <Button variant="outline" size="icon">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent className="overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>
                    <a href={data.logo.url} className="flex items-center gap-2">
                      <img
                        src={data.logo.src}
                        className="max-h-8 dark:invert"
                        alt={data.logo.alt}
                      />
                    </a>
                  </SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-6 p-4">
                  {data.menu && (<Accordion
                    className="flex w-full flex-col gap-4"
                  >
                    {data.menu.map((item) => renderMobileMenuItem(item))}
                  </Accordion>)}

                  <div className="flex flex-col gap-3">
                    <ThemeToggle />
                    <Button variant="outline"
                      onClick={async () => await authClient.signOut()}
                    >Log Out
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </section>
  );
}

const renderMenuItem = (item: MenuItem) => {
  if (item.items) {
    return (
      <NavigationMenuItem key={item.title}>
        <NavigationMenuTrigger>{item.title}</NavigationMenuTrigger>
        <NavigationMenuContent className="bg-popover text-popover-foreground">
          {item.items.map((subItem) => (
            <NavigationMenuLink key={subItem.title} className="w-80">
              <SubMenuLink item={subItem} />
            </NavigationMenuLink>
          ))}
        </NavigationMenuContent>
      </NavigationMenuItem>
    );
  }

  return (
    <NavigationMenuItem key={item.title}>
      <NavigationMenuLink
        href={item.url}
        className="group inline-flex h-10 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted hover:text-accent-foreground"
      >
        {item.title}
      </NavigationMenuLink>
    </NavigationMenuItem>
  );
};

const renderMobileMenuItem = (item: MenuItem) => {
  if (item.items) {
    return (
      <AccordionItem key={item.title} value={item.title} className="border-b-0">
        <AccordionTrigger className="text-md py-0 font-semibold hover:no-underline">
          {item.title}
        </AccordionTrigger>
        <AccordionContent className="mt-2">
          {item.items.map((subItem) => (
            <SubMenuLink key={subItem.title} item={subItem} />
          ))}
        </AccordionContent>
      </AccordionItem>
    );
  }

  return (
    <a key={item.title} href={item.url} className="text-md font-semibold">
      {item.title}
    </a>
  );
};

const SubMenuLink = ({ item }: { item: MenuItem }) => {
  return (
    <a
      className="flex min-w-80 flex-row gap-4 rounded-md p-3 leading-none no-underline transition-colors outline-none select-none hover:bg-muted hover:text-accent-foreground"
      href={item.url}
    >
      <div className="text-foreground">{item.icon}</div>
      <div>
        <div className="text-sm font-semibold">{item.title}</div>
        {item.description && (
          <p className="text-sm leading-snug text-muted-foreground">
            {item.description}
          </p>
        )}
      </div>
    </a>
  );
};

