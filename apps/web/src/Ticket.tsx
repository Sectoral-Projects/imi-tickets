import { TicketContent } from "@/features/tickets/components/ticket";
import { useParams } from "react-router";

export default function Ticket() {
  const { ticketId } = useParams();
  return <TicketContent key={ticketId} />;
}
