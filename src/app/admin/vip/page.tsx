import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/utils'
import { AdminActionButton } from '@/components/admin/vip/admin-vip-ui'

export const dynamic = 'force-dynamic'

const M = '/api/admin/vip/moderation'

function snippet(s: string, n = 220) {
  return s.length > n ? `${s.slice(0, n)}…` : s
}

/** Moderation queue: open reports first, then recent posts and hidden items. */
export default async function AdminVipModerationPage() {
  const [reports, posts, hiddenComments] = await Promise.all([
    prisma.vipReport.findMany({
      where: { status: 'OPEN' },
      orderBy: { createdAt: 'asc' },
      take: 100,
      include: {
        reporter: { select: { email: true, name: true } },
        post: { select: { id: true, body: true, hiddenAt: true, authorId: true, author: { select: { email: true } } } },
        comment: { select: { id: true, body: true, hiddenAt: true, authorId: true, author: { select: { email: true } } } },
      },
    }),
    prisma.vipPost.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        author: { select: { id: true, email: true, name: true } },
        space: { select: { name: true } },
        _count: { select: { comments: true, reactions: true, reports: true } },
      },
    }),
    prisma.vipComment.findMany({
      where: { hiddenAt: { not: null } },
      orderBy: { hiddenAt: 'desc' },
      take: 30,
      include: { author: { select: { email: true } } },
    }),
  ])

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-lg font-semibold">
          Open reports <span className="text-white/40">({reports.length})</span>
        </h2>
        {reports.length === 0 ? (
          <p className="glass rounded-2xl p-5 text-sm text-white/40">No open reports.</p>
        ) : (
          <ul className="space-y-3">
            {reports.map((r) => {
              const item = r.post ?? r.comment
              const isPost = !!r.post
              return (
                <li key={r.id} className="glass rounded-2xl p-5">
                  <p className="text-xs text-white/40">
                    {formatDate(r.createdAt)} · reported by {r.reporter.email} · {isPost ? 'post' : 'comment'}
                    {item?.hiddenAt && <span className="ml-2 text-amber-300">already hidden</span>}
                  </p>
                  <p className="mt-2 text-sm">
                    <span className="text-white/50">Reason:</span> {r.reason}
                  </p>
                  {item && (
                    <blockquote className="mt-2 whitespace-pre-line rounded-xl bg-white/5 p-3 text-sm text-white/80">
                      {snippet(item.body)}
                      <footer className="mt-1 text-xs text-white/40">by {item.author.email}</footer>
                    </blockquote>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item && !item.hiddenAt && (
                      <AdminActionButton
                        endpoint={M}
                        tone="danger"
                        label={isPost ? 'Hide post' : 'Hide comment'}
                        body={isPost ? { action: 'hide_post', postId: item.id } : { action: 'hide_comment', commentId: item.id }}
                        prompt={isPost ? { field: 'reason', question: 'Internal note for hiding (optional)' } : undefined}
                      />
                    )}
                    {item && (
                      <AdminActionButton
                        endpoint={M}
                        label="Suspend author from community"
                        confirmText="Suspend this member from the community? They keep classroom, events and rewards."
                        body={{ action: 'suspend_member', userId: item.authorId }}
                        prompt={{ field: 'reason', question: 'Internal reason (optional)' }}
                      />
                    )}
                    <AdminActionButton endpoint={M} tone="primary" label="Resolve" body={{ action: 'resolve_report', reportId: r.id }} />
                    <AdminActionButton endpoint={M} label="Dismiss" body={{ action: 'dismiss_report', reportId: r.id }} />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Recent posts</h2>
        {posts.length === 0 ? (
          <p className="glass rounded-2xl p-5 text-sm text-white/40">No posts yet.</p>
        ) : (
          <div className="glass overflow-x-auto rounded-2xl">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wider text-white/40">
                  <th className="px-4 py-3">Post</th>
                  <th className="px-4 py-3">Author</th>
                  <th className="px-4 py-3">Activity</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {posts.map((p) => (
                  <tr key={p.id} className={p.hiddenAt ? 'opacity-60' : ''}>
                    <td className="max-w-md px-4 py-3 align-top">
                      <p className="line-clamp-3 whitespace-pre-line">{p.body}</p>
                      <p className="mt-1 text-xs text-white/40">
                        {formatDate(p.createdAt)}
                        {p.space && ` · # ${p.space.name}`}
                        {p.pinned && ' · pinned'}
                        {p.isAnnouncement && ' · announcement'}
                        {p.hiddenAt && ` · HIDDEN${p.hiddenReason ? ` (${p.hiddenReason})` : ''}`}
                      </p>
                    </td>
                    <td className="px-4 py-3 align-top text-white/70">{p.author.email}</td>
                    <td className="px-4 py-3 align-top text-xs text-white/50">
                      {p._count.reactions} likes · {p._count.comments} comments
                      {p._count.reports > 0 && <span className="text-amber-300"> · {p._count.reports} reports</span>}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap gap-1.5">
                        {p.hiddenAt ? (
                          <AdminActionButton endpoint={M} tone="primary" label="Restore" body={{ action: 'restore_post', postId: p.id }} />
                        ) : (
                          <>
                            <AdminActionButton
                              endpoint={M}
                              tone="danger"
                              label="Hide"
                              body={{ action: 'hide_post', postId: p.id }}
                              prompt={{ field: 'reason', question: 'Internal note for hiding (optional)' }}
                            />
                            <AdminActionButton
                              endpoint={M}
                              label={p.pinned ? 'Unpin' : 'Pin'}
                              body={{ action: p.pinned ? 'unpin_post' : 'pin_post', postId: p.id }}
                            />
                            <AdminActionButton
                              endpoint={M}
                              label={p.isAnnouncement ? 'Unmark announcement' : 'Mark announcement'}
                              body={{ action: p.isAnnouncement ? 'unannounce_post' : 'announce_post', postId: p.id }}
                            />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Hidden comments</h2>
        {hiddenComments.length === 0 ? (
          <p className="glass rounded-2xl p-5 text-sm text-white/40">None.</p>
        ) : (
          <ul className="space-y-2">
            {hiddenComments.map((c) => (
              <li key={c.id} className="glass flex flex-wrap items-start justify-between gap-3 rounded-2xl p-4 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 whitespace-pre-line text-white/70">{c.body}</p>
                  <p className="mt-1 text-xs text-white/40">by {c.author.email}</p>
                </div>
                <AdminActionButton endpoint={M} tone="primary" label="Restore" body={{ action: 'restore_comment', commentId: c.id }} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
