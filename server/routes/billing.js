const express = require("express");
const router  = express.Router();
const Stripe  = require("stripe");
const auth    = require("../middleware/auth");
const { User } = require("../db");
require("dotenv").config();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// ⚠️  Replace these with your real Stripe Price IDs
// Dashboard → Products → create each plan → copy price_xxx IDs
const PRICE_MAP = {
  price_1TCLQE7dXP4cTTbz7pUje5Kc: { planId: "starter", interval: "annual" },
  price_1TCLQd7dXP4cTTbzOaw0qUWl:     { planId: "pro",     interval: "annual" },
  price_1TCLR27dXP4cTTbztwQURkkI:   { planId: "teams",   interval: "annual" },
};
console.log("FRONT_URL:", process.env.FRONT_URL);

// ─────────────────────────────────────────────
// GET /api/billing/plan
// Returns the current user's plan
// ─────────────────────────────────────────────
router.get("/plan", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("plan stripeSubscriptionId");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ plan: user.plan });
  } catch (err) {
    console.error("[billing/plan]", err);
    res.status(500).json({ message: "Server error" });
  }
});


// ─────────────────────────────────────────────
// POST /api/billing/set-free
// Sets user plan to free — no Stripe involved
// ─────────────────────────────────────────────
router.post("/set-free", auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { plan: "free" });
    res.json({ plan: "free" });
  } catch (err) {
    console.error("[billing/set-free]", err);
    res.status(500).json({ message: "Server error" });
  }
});


// ─────────────────────────────────────────────
// POST /api/billing/create-checkout
// Creates a Stripe Checkout session
// Body: { planId, priceId, interval }
// Returns: { url } — frontend redirects user to this
// ─────────────────────────────────────────────
router.post("/create-checkout", auth, async (req, res) => {
  const { planId, priceId, interval } = req.body;

  if (!PRICE_MAP[priceId]) {
    return res.status(400).json({ message: "Invalid price ID" });
  }

  try {
    const user = await User.findById(req.user.id).select("email stripeCustomerId");
    if (!user) return res.status(404).json({ message: "User not found" });

    // Reuse existing Stripe customer or create a new one
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email:    user.email,
        metadata: { userId: String(req.user.id) },
      });
      customerId = customer.id;
      await User.findByIdAndUpdate(req.user.id, { stripeCustomerId: customerId });
    }

    const session = await stripe.checkout.sessions.create({
      mode:       "subscription",
      customer:   customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      subscription_data: {
        trial_period_days: 14,
        metadata: { userId: String(req.user.id), planId, interval },
      },
      success_url: `${process.env.FRONT_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${process.env.FRONT_URL}/select-plan`,
      metadata:    { userId: String(req.user.id), planId, interval },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("[billing/create-checkout]", err);
    res.status(500).json({ message: "Could not create checkout session" });
  }
});


// ─────────────────────────────────────────────
// POST /api/billing/confirm-checkout
// Called after Stripe redirects to /billing/success
// Body: { sessionId }
// Returns: { plan }
// ─────────────────────────────────────────────
router.post("/confirm-checkout", auth, async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ message: "Missing sessionId" });

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    if (session.payment_status !== "paid" && session.status !== "complete") {
      return res.status(400).json({ message: "Payment not completed" });
    }

    const planId = session.metadata?.planId;
    if (!planId) return res.status(400).json({ message: "No plan in session" });

    await User.findByIdAndUpdate(req.user.id, {
      plan:                 planId,
      stripeSubscriptionId: session.subscription?.id || null,
      stripeCustomerId:     session.customer,
    });

    res.json({ plan: planId });
  } catch (err) {
    console.error("[billing/confirm-checkout]", err);
    res.status(500).json({ message: "Could not confirm checkout" });
  }
});


// ─────────────────────────────────────────────
// POST /api/billing/webhook
// Stripe calls this when subscriptions change
// Keeps your DB in sync automatically
// ─────────────────────────────────────────────
router.post("/webhook", async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,                            // raw body — needs express.raw() in server.js
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("[webhook] Bad signature:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {

      // Subscription renewed or changed
      case "customer.subscription.updated": {
        const sub     = event.data.object;
        const priceId = sub.items?.data?.[0]?.price?.id;
        const plan    = PRICE_MAP[priceId];
        if (plan) {
          await User.findOneAndUpdate(
            { stripeCustomerId: sub.customer },
            { plan: plan.planId, stripeSubscriptionId: sub.id }
          );
        }
        break;
      }

      // Subscription cancelled or payment failed
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        await User.findOneAndUpdate(
          { stripeCustomerId: sub.customer },
          { plan: "free", stripeSubscriptionId: null }
        );
        break;
      }

      // Payment failed — log it (add email notification here later if needed)
      case "invoice.payment_failed": {
        console.warn("[webhook] Payment failed for customer:", event.data.object.customer);
        break;
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error("[webhook] Handler error:", err);
    res.status(500).json({ message: "Webhook handler failed" });
  }
});


module.exports = router;