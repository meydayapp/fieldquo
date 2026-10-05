// app/components/files/OpenFileLink.js
//
// A link to one stored file, through the route that can actually open it.
//
// `href` is the `openUrl` a list route minted (lib/media/fileOpen.js) — or,
// on a client page, the token route's path. NEVER the stored Cloudinary URL:
// this account refuses to deliver a PDF from it (lib/media/signedFile.js),
// so that link looked like it worked and answered 401.
//
// No href, no link: the name is drawn as plain text. A name you cannot tap
// is honest; a link that fails is the dead control AGENTS.md is swept for.
// The server mints a link for every row it can, so the plain-text case is
// a deployment with no signing secret, not something a person meets.

export default function OpenFileLink({ href, className = "", plainClassName, children, ...rest }) {
  if (!href) return <span className={plainClassName ?? className}>{children}</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className} {...rest}>
      {children}
    </a>
  );
}
