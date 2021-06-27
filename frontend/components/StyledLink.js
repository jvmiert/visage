import Link from "next/link";

export default function StyledLink({ children, href }) {
  return (
    <Link href={href}>
      <a className="text-indigo-600 underline cursor-pointer">{children}</a>
    </Link>
  );
}
