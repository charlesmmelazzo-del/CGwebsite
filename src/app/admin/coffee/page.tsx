import { MenuAdminPanel } from "@/app/admin/menu/page";

export default function AdminCoffeePage() {
  return <MenuAdminPanel pageLabel="Coffee Menu" apiPath="/api/admin/coffee" />;
}
