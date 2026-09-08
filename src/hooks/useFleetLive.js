import { useEffect, useMemo, useState } from 'react';
import {
  subscribeFleetVehicles,
  subscribeCarBookings,
  subscribeCarServices,
  subscribeFleetDrivers,
  subscribeFleetIncidents,
  subscribeFleetWorkOrders,
  listVehicleHandovers,
  computeFleetStats,
} from '../services/fleetService';

// Realtime fleet data — subscribes to Firestore snapshots and recomputes
// a stats object every time any vehicle / booking / service / driver / incident / work order changes.
export const useFleetLive = () => {
  const [vehicles, setVehicles] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [services, setServices] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [handovers, setHandovers] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const unsubs = [
      subscribeFleetVehicles((v) => mounted && setVehicles(v)),
      subscribeCarBookings((b) => mounted && setBookings(b)),
      subscribeCarServices((s) => mounted && setServices(s)),
      subscribeFleetDrivers((d) => mounted && setDrivers(d)),
      subscribeFleetIncidents((i) => mounted && setIncidents(i)),
      subscribeFleetWorkOrders((w) => mounted && setWorkOrders(w)),
    ];
    listVehicleHandovers().then((h) => mounted && setHandovers(h));
    const timer = setTimeout(() => mounted && setLoading(false), 250);
    return () => {
      mounted = false;
      clearTimeout(timer);
      unsubs.forEach((u) => u && u());
    };
  }, []);

  const stats = useMemo(
    () => computeFleetStats({ vehicles, bookings, services, drivers, handovers, incidents, workOrders }),
    [vehicles, bookings, services, drivers, handovers, incidents, workOrders],
  );

  return { stats, vehicles, bookings, services, drivers, handovers, incidents, workOrders, loading };
};