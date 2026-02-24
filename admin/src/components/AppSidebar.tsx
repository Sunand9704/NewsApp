import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  FilePlus2,
  Archive,
  Settings,
  Newspaper,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "New Analysis", url: "/new-analysis", icon: FilePlus2 },
  { title: "Draft Articles", url: "/draft-articles", icon: Archive },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="py-6 px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Newspaper className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold leading-none tracking-tight">Admin Editorial</span>
            <span className="text-[10px] text-muted-foreground mt-1 font-medium uppercase tracking-widest">Workspace</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {navItems.map((item) => {
                const isActive =
                  item.url === "/"
                    ? location.pathname === "/"
                    : location.pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                      className="transition-all duration-200"
                    >
                      <Link to={item.url}>
                        <item.icon className={isActive ? "text-primary" : ""} />
                        <span className={isActive ? "font-semibold" : ""}>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t p-4">
        <div className="flex flex-col gap-1">
          <div className="h-1 w-8 rounded-full bg-primary/20 mb-2" />
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">AI Editorial System</p>
          <p className="text-[9px] text-muted-foreground/60">v1.2.0 • Active Session</p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
