import clsx from "clsx";
import type { User } from "../../types";
import { AvatarImage } from "./AvatarImage";

interface AvatarStackProps {
  users: User[];
  max?: number;
}

export const AvatarStack = ({ users, max = 3 }: AvatarStackProps) => {
  const visibleUsers = users.slice(0, max);
  const overflow = users.length - visibleUsers.length;

  return (
    <div className="flex items-center">
      {visibleUsers.map((user, index) => (
        <AvatarImage
          key={user.id}
          src={user.avatar}
          name={user.name}
          className={clsx(
            "h-8 w-8 rounded-full border-2 border-white object-cover shadow-sm",
            index > 0 && "-ml-2"
          )}
        />
      ))}

      {overflow > 0 ? (
        <span className="-ml-2 inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-brand-accent text-xs font-semibold text-brand-deep">
          +{overflow}
        </span>
      ) : null}
    </div>
  );
};
