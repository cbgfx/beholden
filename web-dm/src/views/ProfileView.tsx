import { ProfileSettings } from "@beholden/shared/ui/ProfileSettings";
import { theme } from "@/theme/theme";
import { Button } from "@/ui/Button";
import { Select } from "@/ui/Select";

export function ProfileView() {
  return <ProfileSettings theme={theme} Button={Button} SelectComponent={Select} />;
}
