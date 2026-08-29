package graph

// This file is maintained by hand; gqlgen keeps unknown code on regeneration.

import (
	"context"

	api "github.com/idk4whatamiusing/meridian_stack/api"
	aipb "github.com/idk4whatamiusing/meridian_stack/api/pb/aipb"
	dbpb "github.com/idk4whatamiusing/meridian_stack/api/pb/dbpb"
)

// ---- mutations ----

func (r *mutationResolver) Broadcast(ctx context.Context, message string) (bool, error) {
	r.Hub.Broadcast("api: " + message) // parallel fanout #1: local subscribers
	r.Clients.NotifyRealtime(message)  // parallel fanout #2: gleam realtime (best-effort)
	return true, nil
}

func (r *mutationResolver) RunCycle(ctx context.Context, tickers []string) (string, error) {
	reply, err := r.Clients.Ai.RunCycle(r.Clients.Ctx(ctx), &aipb.RunCycleRequest{Tickers: tickers})
	if err != nil {
		return "", err
	}
	return reply.Status, nil
}

// ---- queries ----

func (r *queryResolver) Health(ctx context.Context) (string, error) { return "ok", nil }

func (r *queryResolver) Decisions(ctx context.Context, limit *int) ([]*api.Decision, error) {
	rep, err := r.Clients.DB.ListDecisions(r.Clients.Ctx(ctx), &dbpb.ListDecisionsRequest{Limit: int32OrDefault(limit, 50)})
	if err != nil {
		return nil, err
	}
	out := make([]*api.Decision, len(rep.Decisions))
	for i, d := range rep.Decisions {
		out[i] = &api.Decision{
			ID: d.Id, Ticker: d.Ticker, RunDate: d.RunDate, Direction: d.Direction,
			Confidence: float64(d.Confidence), Summary: d.Summary, FullReport: d.FullReport,
			CreatedAt: d.CreatedAt,
		}
	}
	return out, nil
}

func (r *queryResolver) Trades(ctx context.Context, status *string, limit *int) ([]*api.Trade, error) {
	var st string
	if status != nil {
		st = *status
	}
	rep, err := r.Clients.DB.ListTrades(r.Clients.Ctx(ctx), &dbpb.ListTradesRequest{Status: st, Limit: int32OrDefault(limit, 50)})
	if err != nil {
		return nil, err
	}
	out := make([]*api.Trade, len(rep.Trades))
	for i, t := range rep.Trades {
		out[i] = tradeFromPB(t)
	}
	return out, nil
}

func (r *queryResolver) RiskGateEvents(ctx context.Context, limit *int) ([]*api.RiskGateEvent, error) {
	rep, err := r.Clients.DB.ListRiskGateEvents(r.Clients.Ctx(ctx), &dbpb.ListRiskGateEventsRequest{Limit: int32OrDefault(limit, 100)})
	if err != nil {
		return nil, err
	}
	out := make([]*api.RiskGateEvent, len(rep.Events))
	for i, e := range rep.Events {
		out[i] = &api.RiskGateEvent{
			ID: e.Id, TradeID: strPtrOrNil(e.TradeId), GateName: e.GateName,
			Passed: e.Passed, Reason: e.Reason, CreatedAt: e.CreatedAt,
		}
	}
	return out, nil
}

func (r *queryResolver) LatestSnapshot(ctx context.Context) (*api.AccountSnapshot, error) {
	s, err := r.Clients.DB.GetLatestAccountSnapshot(r.Clients.Ctx(ctx), &dbpb.GetLatestAccountSnapshotRequest{})
	if err != nil {
		return nil, nil // no snapshot yet - not an error for the dashboard
	}
	return snapshotFromPB(s), nil
}

func (r *queryResolver) AccountSnapshots(ctx context.Context, limit *int) ([]*api.AccountSnapshot, error) {
	rep, err := r.Clients.DB.ListAccountSnapshots(r.Clients.Ctx(ctx), &dbpb.ListAccountSnapshotsRequest{Limit: int32OrDefault(limit, 100)})
	if err != nil {
		return nil, err
	}
	out := make([]*api.AccountSnapshot, len(rep.Snapshots))
	for i, s := range rep.Snapshots {
		out[i] = snapshotFromPB(s)
	}
	return out, nil
}

// ---- subscriptions ----

func (r *subscriptionResolver) Events(ctx context.Context) (<-chan string, error) {
	ch := r.Hub.Subscribe()
	go func() {
		<-ctx.Done()
		r.Hub.Unsubscribe(ch)
	}()
	return ch, nil
}

// ---- helpers ----

func int32OrDefault(p *int, def int) int32 {
	if p == nil {
		return int32(def)
	}
	return int32(*p)
}

func strPtrOrNil(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func f64PtrOrNil(f float64) *float64 {
	if f == 0 {
		return nil
	}
	return &f
}

func legsFromPB(legs []*dbpb.Leg) []*api.Leg {
	out := make([]*api.Leg, len(legs))
	for i, l := range legs {
		out[i] = &api.Leg{
			Side: l.Side, Right: l.Right, Strike: l.Strike, Expiry: l.Expiry,
			Symbol: l.Symbol, RatioQty: int(l.RatioQty),
		}
	}
	return out
}

func tradeFromPB(t *dbpb.Trade) *api.Trade {
	return &api.Trade{
		ID: t.Id, DecisionID: strPtrOrNil(t.DecisionId), Ticker: t.Ticker, Strategy: t.Strategy,
		Legs: legsFromPB(t.Legs), Expiry: t.Expiry, Quantity: int(t.Quantity),
		CreditDebit: t.CreditDebit, NetPremium: t.NetPremium, MaxProfit: t.MaxProfit, MaxLoss: t.MaxLoss,
		Status: t.Status, AlpacaOrderID: strPtrOrNil(t.AlpacaOrderId), RealizedPnl: f64PtrOrNil(t.RealizedPnl),
		Rationale: strPtrOrNil(t.Rationale), OpenedAt: strPtrOrNil(t.OpenedAt), ClosedAt: strPtrOrNil(t.ClosedAt),
		CreatedAt: t.CreatedAt,
	}
}

func snapshotFromPB(s *dbpb.AccountSnapshot) *api.AccountSnapshot {
	return &api.AccountSnapshot{
		ID: s.Id, Equity: s.Equity, Cash: s.Cash, BuyingPower: s.BuyingPower,
		OptionsBuyingPower: f64PtrOrNil(s.OptionsBuyingPower), DayPnl: f64PtrOrNil(s.DayPnl),
		OpenPositionsCount: int(s.OpenPositionsCount), CreatedAt: s.CreatedAt,
	}
}

// Mutation returns MutationResolver implementation.
func (r *Resolver) Mutation() MutationResolver { return &mutationResolver{r} }

// Query returns QueryResolver implementation.
func (r *Resolver) Query() QueryResolver { return &queryResolver{r} }

// Subscription returns SubscriptionResolver implementation.
func (r *Resolver) Subscription() SubscriptionResolver { return &subscriptionResolver{r} }

type (
	mutationResolver     struct{ *Resolver }
	queryResolver        struct{ *Resolver }
	subscriptionResolver struct{ *Resolver }
)
