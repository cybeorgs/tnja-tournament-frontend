import { Badge } from "./ui";
import type { Tournament } from "@/lib/types";

export function TournamentStatusBadge({ tournament }: { tournament: Pick<Tournament, "status" | "resultsPublished"> }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {tournament.status === "PUBLISHED" && <Badge color="blue">Published</Badge>}
      {tournament.status === "COMPLETED" && <Badge color="green">Completed</Badge>}
      {tournament.resultsPublished && <Badge color="yellow">Results out</Badge>}
    </span>
  );
}
