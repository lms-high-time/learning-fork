# Security Policy

This repository is the High Time fork of [Frappe Learning](https://github.com/frappe/lms):
the `high-time` branch carries our changes on top of upstream. Where a report
goes depends on where the issue lives.

## Issues in this fork

If the issue is in code that exists only here — something you cannot reproduce
on upstream `frappe/lms` — please report it privately to
**support@cenda.app** with the subject "Security: learning-fork". Do not open a
public issue or pull request before we reply: the repository is public, and a
public report is visible to everyone before a fix ships.

Useful to include: what is affected (page, API method, DocType), how to
reproduce it (request, role, response), what an attacker gains, and the
revision you tested (`git rev-parse HEAD`) or the date.

We aim to reply within a few business days, tell you whether we confirm the
issue and when to expect a fix, and credit you in the change if you wish.

## Issues in upstream Frappe Learning or Frappe Framework

If the issue also exists in upstream `frappe/lms` or in Frappe Framework,
please report it to the Frappe team as described at
[frappe.io/security](https://frappe.io/security). We pick up their fixes when
we sync with upstream. If you are unsure which side it belongs to, write to
support@cenda.app and we will route it.
