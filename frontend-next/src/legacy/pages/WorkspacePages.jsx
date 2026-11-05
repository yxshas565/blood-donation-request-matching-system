import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, ArrowUpRight, Bell, Boxes, CalendarDays, Check, CircleGauge, ClipboardList, Clock3, Droplet, HeartPulse, MapPin, Plus, RefreshCw, Search, Trash2, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { adminApi, api, donationApi, donorApi, hospitalApi, inventoryApi, matchingApi, notificationApi, organizationApi, requestApi } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { BloodBadge, Button, DataTable, EmptyState, ErrorState, Field, LoadingState, MetricCard, Modal, PageHeading, Panel, SectionLabel, SelectField, StatusBadge, useToast } from '../components/ui.jsx';

function useRemote(loader, dependencies = []) {
  const [state, setState] = useState({ loading:true, error:'', data:null });
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((n) => n + 1), []);
  useEffect(() => { let active=true;setState((s)=>({...s,loading:true,error:''}));loader().then((data)=>{if(active)setState({loading:false,error:'',data});}).catch((error)=>{if(active)setState({loading:false,error:error.message,data:null});});return()=>{active=false;}; }, [...dependencies,version]);
  return { ...state, refresh };
}

function SummaryBand({ children, label = 'SYSTEM NOTE' }) { return <div className="summary-band"><span className="summary-led" /><div><span className="mono-label">{label}</span><p>{children}</p></div></div>; }
function PanelTitle({ label, title, action }) { return <div className="panel-title"><div><span className="mono-label">{label}</span><h2>{title}</h2></div>{action}</div>; }
function Loadable({ loading, error, refresh, children }) { if(loading)return <LoadingState/>;if(error)return <ErrorState error={error} onRetry={refresh}/>;return children; }
const groupName=(row)=>row.Blood_Type?`${row.Blood_Type}${row.Rh_Factor}`:row.blood_group||row.bloodGroup||'â€”';
const groupById={1:'A+',2:'A-',3:'B+',4:'B-',5:'AB+',6:'AB-',7:'O+',8:'O-'};
const dateText=(value)=>{if(!value)return 'â€”';const raw=typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)?`${value}T00:00:00.000Z`:value;const date=new Date(raw);return Number.isNaN(date.valueOf())?String(value):new Intl.DateTimeFormat(undefined,{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'}).format(date);};
const localDateOnly=()=>{const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;};
const niceStatus=(status)=>String(status||'').replaceAll('_',' ');

export function DashboardPage() {
  const { user }=useAuth(); const role=user?.Role;
  const loader=useCallback(async()=>{
    if(role==='Donor'){const [profile,donations,notifications]=await Promise.all([donorApi.profile(),donorApi.donations(),notificationApi.list()]);return{profile:profile.donor,donations:donations.donations||[],notifications:notifications.notifications||[]};}
    if(role==='Hospital'){const [profile,inventory,requests,donations]=await Promise.all([hospitalApi.profile(),hospitalApi.inventory(),requestApi.list(),hospitalApi.donations()]);return{profile:profile.profile,inventory:inventory.inventory||[],requests:requests.requests||[],donations:donations.donations||[]};}
    if(role==='Organization'){const [profile,requests,notifications]=await Promise.all([organizationApi.profile(),requestApi.list(),notificationApi.list()]);return{profile:profile.profile,requests:requests.requests||[],notifications:notifications.notifications||[]};}
    const [summary,users,requests,inventory]=await Promise.all([adminApi.summary(),adminApi.users(),adminApi.requests(),adminApi.organizations()]);return{summary,users:users.users||[],requests:requests.requests||[],organizations:inventory};
  },[role]);
  const result=useRemote(loader,[role]);
  return <Loadable {...result}><DashboardContent role={role} user={user} data={result.data} refresh={result.refresh}/></Loadable>;
}

function DashboardContent({role,user,data,refresh}) {
  if(role==='Donor') {const donor=data.profile;const group=`${donor?.Blood_Type||''}${donor?.Rh_Factor||''}`;return <><PageHeading eyebrow="DONOR CONSOLE / OVERVIEW" title={`Good day, ${user.Name?.split(' ')[0]||'donor'}.`} description="Your availability and details help requesters find a compatible match." action={<Link to="/app/profile" className="key-button key-secondary">Update details <ArrowUpRight size={16}/></Link>}/><div className="metric-grid"><MetricCard label="BLOOD GROUP" value={group||'â€”'} detail="MySQL donor profile" icon={Droplet}/><MetricCard label="AVAILABILITY" value={donor?.Availability_Status?'Available':'Unavailable'} detail="Used in matching" icon={CircleGauge} tone={donor?.Availability_Status?'green':'default'}/><MetricCard label="DONATION RECORDS" value={data.donations.length} detail="Recorded donation history" icon={HeartPulse}/><MetricCard label="LAST DONATION" value={dateText(donor?.Last_Donation_Date)} detail="From your donor profile" icon={CalendarDays}/></div><div className="dashboard-two-col"><Panel><PanelTitle label="YOUR NEXT STEP" title="Keep your profile current"/><p className="panel-copy">Requesters only see donor matches when the record is marked available. Review your location and availability when they change.</p><div className="panel-actions"><Link className="key-button key-primary" to="/app/profile">Review donor profile <ArrowRight size={16}/></Link></div></Panel><Panel><PanelTitle label="RECENT ACTIVITY" title="Latest notifications" action={<Link className="text-link" to="/app/notifications">View all <ArrowRight size={14}/></Link>}/>{data.notifications.slice(0,3).length?<div className="activity-list">{data.notifications.slice(0,3).map((n)=><ActivityItem key={n._id} title={n.title} copy={n.message} date={n.created_at}/>)}</div>:<EmptyState title="No notifications yet" description="Request updates and matching notices will appear here."/>}</Panel></div><SummaryBand>Matching is informational. Clinical staff must confirm donation eligibility and transfusion suitability.</SummaryBand></>}
  if(role==='Hospital') {const pending=data.requests.filter(x=>x.Request_Status==='Pending').length;const total=data.inventory.reduce((sum,x)=>sum+Number(x.Quantity_Available||0),0);return <><PageHeading eyebrow="HOSPITAL CONSOLE / OVERVIEW" title={data.profile?.Hospital_Name||'Hospital workspace'} description="Coordinate requests, available stock and compatible donor discovery." action={<Link className="key-button key-primary" to="/app/requests">New blood request <Plus size={17}/></Link>}/><div className="metric-grid"><MetricCard label="AVAILABLE UNITS" value={total.toFixed(2)} detail="Across this hospitalâ€™s inventory" icon={Boxes}/><MetricCard label="TOTAL REQUESTS" value={data.requests.length} detail="Hospital-owned records" icon={ClipboardIcon}/><MetricCard label="PENDING" value={pending} detail="Awaiting coordination" icon={Clock3} tone={pending?'orange':'default'}/><MetricCard label="DONATION RECORDS" value={data.donations.length} detail="Associated with this hospital" icon={HeartPulse}/></div><div className="dashboard-two-col"><Panel><PanelTitle label="STOCK BAY" title="Current inventory" action={<Link className="text-link" to="/app/inventory">Open inventory <ArrowRight size={14}/></Link>}/><DataTable rowKey="Inventory_ID" rows={data.inventory.slice(0,5)} columns={[{key:'group',label:'Blood group',render:(x)=><BloodBadge group={groupName(x)}/>},{key:'Quantity_Available',label:'Available',render:(x)=><strong>{Number(x.Quantity_Available||0).toFixed(2)} units</strong>},{key:'Last_Updated',label:'Updated',render:(x)=>dateText(x.Last_Updated)}]} emptyTitle="Inventory is empty" emptyDescription="Approved donations will appear once recorded for this hospital."/></Panel><Panel><PanelTitle label="REQUEST TRACKER" title="Latest requests" action={<Link className="text-link" to="/app/requests">View all <ArrowRight size={14}/></Link>}/><DataTable rowKey="Request_ID" rows={data.requests.slice(0,5)} columns={[{key:'Request_ID',label:'Request'},{key:'group',label:'Group',render:(x)=><BloodBadge group={groupName(x)}/>},{key:'Urgency',label:'Urgency',render:(x)=><StatusBadge status={x.Urgency}/>},{key:'Request_Status',label:'Status',render:(x)=><StatusBadge status={x.Request_Status}/>}]} emptyTitle="No requests yet" emptyDescription="Create a request to start a donor match search."/></Panel></div><SummaryBand>Final donor suitability and transfusion decisions require appropriate clinical screening.</SummaryBand></>}
  if(role==='Organization')return <><PageHeading eyebrow="ORGANIZATION CONSOLE / OVERVIEW" title={data.profile?.Organization_Name||'Organization workspace'} description="Submit and follow blood requests and review compatible donor matches." action={<Link className="key-button key-primary" to="/app/requests">Create a request <Plus size={17}/></Link>}/><div className="metric-grid"><MetricCard label="YOUR REQUESTS" value={data.requests.length} detail="Organization-owned requests" icon={ClipboardIcon}/><MetricCard label="PENDING" value={data.requests.filter(x=>x.Request_Status==='Pending').length} detail="Awaiting coordination" icon={Clock3}/><MetricCard label="FULFILLED" value={data.requests.filter(x=>x.Request_Status==='Fulfilled').length} detail="Completed requests" icon={Check}/><MetricCard label="NOTIFICATIONS" value={data.notifications.length} detail="Recent messages" icon={Bell}/></div><Panel><PanelTitle label="REQUEST TRACKER" title="Recent requests" action={<Link className="text-link" to="/app/requests">Manage requests <ArrowRight size={14}/></Link>}/><DataTable rowKey="Request_ID" rows={data.requests.slice(0,8)} columns={[{key:'Request_ID',label:'Request'},{key:'group',label:'Blood group',render:(x)=><BloodBadge group={groupName(x)}/>},{key:'Quantity_Required',label:'Units'},{key:'Urgency',label:'Urgency',render:(x)=><StatusBadge status={x.Urgency}/>},{key:'Request_Status',label:'Status',render:(x)=><StatusBadge status={x.Request_Status}/>},{key:'Request_Date',label:'Submitted',render:(x)=>dateText(x.Request_Date)}]} emptyTitle="No organization requests" emptyDescription="Your submitted requests will appear here."/></Panel><SummaryBand>Organization requests can be matched to donors. Inventory-backed fulfilment is available for hospital-owned requests.</SummaryBand></>;
  const summary=data.summary;const totalUsers=data.users.length;const counts=summary?.users||[];const donationTotal=(summary?.donations||[]).reduce((n,x)=>n+Number(x.count||0),0);const requestTotal=(summary?.requests||[]).reduce((n,x)=>n+Number(x.count||0),0);return <><PageHeading eyebrow="ADMIN CONSOLE / OVERVIEW" title="Network overview." description="A live summary of users, requests, donations and available inventory." action={<Button variant="secondary" onClick={refresh} icon={RefreshCw}>Refresh</Button>}/><div className="metric-grid"><MetricCard label="REGISTERED USERS" value={totalUsers} detail={counts.map((x)=>`${x.count} ${x.Role}`).join(' Â· ')||'By account role'} icon={Users}/><MetricCard label="DONORS" value={summary?.donorCount??0} detail="Relational donor records" icon={HeartPulse}/><MetricCard label="DONATION RECORDS" value={donationTotal} detail="All statuses" icon={Droplet}/><MetricCard label="INVENTORY UNITS" value={Number(summary?.inventory?.units||0).toFixed(2)} detail={`${requestTotal} total blood requests`} icon={Boxes}/></div><div className="dashboard-two-col"><Panel><PanelTitle label="REQUESTS / LIVE" title="Request status distribution"/><StatusDistribution rows={summary?.requests||[]}/></Panel><Panel><PanelTitle label="DONATIONS / LIVE" title="Donation status distribution"/><StatusDistribution rows={summary?.donations||[]} field="Donation_Status"/></Panel></div><SummaryBand>Administrative views omit password hashes and use live database records.</SummaryBand></>;
}
function ClipboardIcon(props){return <ClipboardList {...props}/>;}
function StatusDistribution({rows,field='Request_Status'}){const total=rows.reduce((n,row)=>n+Number(row.count||0),0);return total?<div className="distribution-list">{rows.map((row)=><div className="distribution-row" key={row[field]}><span className="distribution-name"><StatusBadge status={row[field]}/></span><div className="distribution-track"><i style={{width:`${Math.max(3,Number(row.count)/total*100)}%`}}/></div><strong>{row.count}</strong></div>)}</div>:<EmptyState title="No records to summarize" description="Counts will appear as records are added to the network."/>;}
function ActivityItem({title,copy,date}){return <div className="activity-item"><i/><div><strong>{title||'Activity update'}</strong><p>{copy}</p><small>{dateText(date)}</small></div></div>;}

export function ProfilePage(){const {user}=useAuth();const role=user?.Role;const toast=useToast();const loader=useCallback(async()=>{if(role==='Donor'){const r=await donorApi.profile();return r.donor;}if(role==='Hospital')return(await hospitalApi.profile()).profile;if(role==='Organization')return(await organizationApi.profile()).profile;return(await api('/users/me')).user;},[role]);const result=useRemote(loader,[role]);return <Loadable {...result}><ProfileContent role={role} user={user} profile={result.data} refresh={result.refresh} toast={toast}/></Loadable>;}
function ProfileContent({role,user,profile,refresh,toast}){const [busy,setBusy]=useState(false);const [form,setForm]=useState({});const [location,setLocation]=useState({longitude:'',latitude:'',city:'',area:''});useEffect(()=>{setForm({hospitalName:profile?.Hospital_Name||'',organizationName:profile?.Organization_Name||'',address:profile?.Address||'',phone:profile?.Phone||'',organizationType:profile?.Organization_Type||''});},[profile]);
 const toggleAvailability=async()=>{setBusy(true);try{await donorApi.availability(!Boolean(profile?.Availability_Status));toast(`Availability marked ${profile?.Availability_Status?'unavailable':'available'}.`);refresh();}catch(error){toast(error.message,'error');}finally{setBusy(false);}};
 const save=async(e)=>{e.preventDefault();setBusy(true);try{if(role==='Hospital')await hospitalApi.update(form);else await organizationApi.update(form);toast('Profile changes saved.');refresh();}catch(error){toast(error.message,'error');}finally{setBusy(false);}};
 const saveLocation=async(e)=>{e.preventDefault();const lon=Number(location.longitude),lat=Number(location.latitude);if(!Number.isFinite(lon)||!Number.isFinite(lat)||lon < -180||lon>180||lat < -90||lat>90){toast('Enter valid longitude (âˆ’180 to 180) and latitude (âˆ’90 to 90).','error');return;}setBusy(true);try{await donorApi.location({...location,longitude:lon,latitude:lat});toast('Donor location saved.');}catch(error){toast(error.message,'error');}finally{setBusy(false);}};
 return <><PageHeading eyebrow={`${role?.toUpperCase()} / PROFILE`} title="Profile & details" description="Review the information connected to your Bloodline account."/><div className="profile-grid"><Panel className="profile-summary"><div className="profile-avatar">{(user?.Name||'U').split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase()}</div><span className="role-pill"><i/>{role}</span><h2>{profile?.Name||profile?.Hospital_Name||profile?.Organization_Name||user?.Name}</h2><p>{profile?.Email||user?.Email}</p>{role==='Donor'&&<><div className="profile-blood"><BloodBadge group={`${profile?.Blood_Type||''}${profile?.Rh_Factor||''}`}/><StatusBadge status={profile?.Availability_Status?'Available':'Unavailable'}/></div><div className="profile-detail"><span>Last donation</span><strong>{dateText(profile?.Last_Donation_Date)}</strong></div><div className="profile-detail"><span>Gender</span><strong>{profile?.Gender||'Not provided'}</strong></div></>}</Panel>
 {role==='Donor'?<div className="profile-main"><Panel><div className="panel-title"><div><span className="mono-label">AVAILABILITY / MATCHING INPUT</span><h2>Donor availability</h2></div><StatusBadge status={profile?.Availability_Status?'Available':'Unavailable'}/></div><p className="panel-copy">Request matching includes donors who are marked available. Update this when your availability changes.</p><Button variant={profile?.Availability_Status?'secondary':'primary'} disabled={busy} onClick={toggleAvailability}>{profile?.Availability_Status?'Mark unavailable':'Mark available'}</Button></Panel><Panel><PanelTitle label="DONOR RECORD" title="Account information"/><div className="read-only-grid"><div><span>Full name</span><strong>{profile?.Name||user?.Name}</strong></div><div><span>Email</span><strong>{profile?.Email||user?.Email}</strong></div><div><span>Phone</span><strong>{profile?.Phone||'Not provided'}</strong></div><div><span>Date of birth</span><strong>{dateText(profile?.Date_of_Birth)}</strong></div><div><span>Blood group</span><strong>{profile?.Blood_Type}{profile?.Rh_Factor}</strong></div><div><span>Donor ID</span><strong>#{profile?.Donor_ID}</strong></div></div><SummaryBand>Personal information editing is not available in the current backend.</SummaryBand></Panel><Panel><PanelTitle label="LOCATION / MONGODB" title="Donor location"/><p className="panel-copy">Set coordinates only when you know the location to record. Coordinates use longitude first, then latitude.</p><form className="form-stack" onSubmit={saveLocation}><div className="form-grid"><Field id="loc-city" label="City" value={location.city} onChange={e=>setLocation({...location,city:e.target.value})} placeholder="City"/><Field id="loc-area" label="Area" value={location.area} onChange={e=>setLocation({...location,area:e.target.value})} placeholder="District or neighborhood"/><Field id="loc-lon" label="Longitude" type="number" step="any" min="-180" max="180" required value={location.longitude} onChange={e=>setLocation({...location,longitude:e.target.value})} placeholder="77.5946"/><Field id="loc-lat" label="Latitude" type="number" step="any" min="-90" max="90" required value={location.latitude} onChange={e=>setLocation({...location,latitude:e.target.value})} placeholder="12.9716"/></div><Button type="submit" disabled={busy}>Save location</Button></form></Panel></div>:role==='Admin'?<Panel><PanelTitle label="ADMINISTRATOR" title="Account information"/><div className="read-only-grid"><div><span>Account holder</span><strong>{profile?.Name||user?.Name}</strong></div><div><span>Email</span><strong>{profile?.Email||user?.Email}</strong></div><div><span>Role</span><strong>{profile?.Role||user?.Role}</strong></div><div><span>User ID</span><strong>#{profile?.User_ID||user?.User_ID}</strong></div></div></Panel>:<Panel><PanelTitle label="ORGANIZATION RECORD" title="Edit profile"/><form className="form-stack" onSubmit={save}>{role==='Hospital'?<Field id="hospital-name" label="Hospital name" required value={form.hospitalName||''} onChange={e=>setForm({...form,hospitalName:e.target.value})}/>:<><Field id="organization-name" label="Organization name" required value={form.organizationName||''} onChange={e=>setForm({...form,organizationName:e.target.value})}/><Field id="organization-type" label="Organization type" value={form.organizationType||''} onChange={e=>setForm({...form,organizationType:e.target.value})}/></>}<div className="form-grid"><Field id="profile-address" label="Address" value={form.address||''} onChange={e=>setForm({...form,address:e.target.value})}/><Field id="profile-phone" label="Phone" value={form.phone||''} onChange={e=>setForm({...form,phone:e.target.value})}/></div><Button type="submit" disabled={busy}>Save profile</Button></form></Panel>}</div></>;
}

export function RequestsPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState('');
  const [urgency, setUrgency] = useState('');
  const [show, setShow] = useState(false);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const toast = useToast();

  const loader = useCallback(
    () =>
      user?.Role === 'Admin'
        ? adminApi.requests()
        : requestApi.list({ status, urgency }),
    [user?.Role, status, urgency]
  );

  const result = useRemote(loader, [user?.Role, status, urgency]);

  const canCreate = ['Hospital', 'Organization'].includes(user?.Role);
  const canManage = canCreate || user?.Role === 'Admin';

  const openDetail = async (row) => {
    setSelected(row.Request_ID);
    try {
      const r = await requestApi.get(row.Request_ID);
      setDetail(r.request);
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const setRequestStatus = async (row, next) => {
    if (!window.confirm(`${next === 'Cancelled' ? 'Cancel' : 'Update'} request #${row.Request_ID}?`)) return;

    try {
      const response = await requestApi.status(row.Request_ID, next);

      toast(
        response.syncStatus === 'pending'
          ? `Request ${row.Request_ID} updated; notification synchronization is pending.`
          : `Request ${row.Request_ID} ${next.toLowerCase()}.`,
        response.syncStatus === 'pending' ? 'error' : 'success'
      );

      setSelected(null);
      setDetail(null);
      result.refresh();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  // Open the custom confirmation modal instead of a browser popup.
  const deleteRequest = (row) => {
    setDeleteTarget(row);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleteBusy) return;

    setDeleteBusy(true);

    try {
      const response = await requestApi.remove(deleteTarget.Request_ID);

      toast(
        response.syncStatus === 'pending'
          ? 'Request cancelled; notification synchronization is pending.'
          : 'Request deleted successfully.',
        response.syncStatus === 'pending' ? 'error' : 'success'
      );

      setSelected(null);
      setDetail(null);
      setDeleteTarget(null);

      // Reload the list. Cancelled requests are hidden by default.
      result.refresh();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setDeleteBusy(false);
    }
  };

  const fulfil = async (row) => {
    if (!window.confirm(`Fulfil request #${row.Request_ID} from hospital inventory? This deducts ${row.Quantity_Required} units.`)) return;

    try {
      const response = await requestApi.fulfil(row.Request_ID);

      toast(
        response.syncStatus === 'pending'
          ? 'Request fulfilled and inventory updated; notification synchronization is pending.'
          : 'Request fulfilled and inventory updated.',
        response.syncStatus === 'pending' ? 'error' : 'success'
      );

      setSelected(null);
      setDetail(null);
      result.refresh();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const columns = [
    {
      key: 'Request_ID',
      label: 'Request ID',
      render: (r) => (
        <button className="table-link" onClick={() => openDetail(r)}>
          BR-{r.Request_ID}
        </button>
      )
    },
    {
      key: 'Blood_Type',
      label: 'Blood group',
      render: (r) => <BloodBadge group={groupName(r)} />
    },
    {
      key: 'Quantity_Required',
      label: 'Quantity',
      render: (r) => `${Number(r.Quantity_Required).toFixed(2)} units`
    },
    {
      key: 'Request_Date',
      label: 'Date',
      render: (r) => dateText(r.Request_Date)
    },
    {
      key: 'Urgency',
      label: 'Urgency',
      render: (r) => <StatusBadge status={r.Urgency} />
    },
    {
      key: 'Request_Status',
      label: 'Status',
      render: (r) => <StatusBadge status={r.Request_Status} />
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (r) => (
        <div className="table-actions">
          <button className="table-action" onClick={() => openDetail(r)}>
            Details
          </button>

          {canManage &&
            ['Pending', 'Partially_Fulfilled'].includes(r.Request_Status) && (
              <button
                className="table-action table-action-warn"
                onClick={() => deleteRequest(r)}
              >
                <Trash2 size={13} /> Delete
              </button>
            )}

          {user?.Role === 'Hospital' &&
            r.Hospital_ID &&
            r.Request_Status === 'Pending' && (
              <button
                className="table-action table-action-good"
                onClick={() => fulfil(r)}
              >
                Fulfil
              </button>
            )}
        </div>
      )
    }
  ];

  // Cancelled records remain accessible through the Cancelled filter.
  const filteredRequests = (result.data?.requests || []).filter(
    (r) =>
      (status
        ? r.Request_Status === status
        : r.Request_Status !== 'Cancelled') &&
      (!urgency || r.Urgency === urgency)
  );

  return (
    <>
      <PageHeading
        eyebrow={`${user?.Role?.toUpperCase()} / REQUEST TRACKER`}
        title="Blood requests"
        description="Review request status, urgency and blood group. Your role limits the records you can manage."
        action={
          canCreate && (
            <Button onClick={() => setShow(true)} icon={Plus}>
              Create request
            </Button>
          )
        }
      />

      <div className="filter-bar">
        <div className="filter-title">
          <Search size={16} />
          <span>Filter request records</span>
        </div>

        <SelectField
          id="request-status"
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Active requests</option>
          {['Pending', 'Partially_Fulfilled', 'Fulfilled', 'Cancelled'].map(
            (s) => (
              <option value={s} key={s}>
                {niceStatus(s)}
              </option>
            )
          )}
        </SelectField>

        <SelectField
          id="request-urgency"
          label="Urgency"
          value={urgency}
          onChange={(e) => setUrgency(e.target.value)}
        >
          <option value="">All urgency levels</option>
          {['Low', 'Medium', 'High', 'Critical'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </SelectField>
      </div>

      <Panel>
        <PanelTitle label="REQUEST DATA / LIVE" title="Request register" />

        <Loadable {...result}>
          <DataTable
            rowKey="Request_ID"
            rows={filteredRequests}
            columns={columns}
            emptyTitle="No matching requests"
            emptyDescription="Try changing the filters, or create a request when you need blood."
          />
        </Loadable>
      </Panel>

      {show && (
        <CreateRequestModal
          onClose={() => setShow(false)}
          onCreated={() => {
            setShow(false);
            result.refresh();
          }}
        />
      )}

      {selected && detail && (
        <Modal
          title={`Request BR-${selected}`}
          onClose={() => {
            setSelected(null);
            setDetail(null);
          }}
        >
          <div className="detail-grid">
            <div>
              <span>Blood group</span>
              <strong>
                <BloodBadge group={groupName(detail)} />
              </strong>
            </div>

            <div>
              <span>Quantity required</span>
              <strong>{Number(detail.Quantity_Required).toFixed(2)} units</strong>
            </div>

            <div>
              <span>Urgency</span>
              <strong><StatusBadge status={detail.Urgency} /></strong>
            </div>

            <div>
              <span>Status</span>
              <strong><StatusBadge status={detail.Request_Status} /></strong>
            </div>

            <div>
              <span>Submitted</span>
              <strong>{dateText(detail.Request_Date)}</strong>
            </div>
          </div>

          <div className="modal-actions">
            {canManage &&
              ['Pending', 'Partially_Fulfilled'].includes(detail.Request_Status) && (
                <Button
                  variant="secondary"
                  onClick={() => deleteRequest(detail)}
                >
                  Delete request
                </Button>
              )}

            {user?.Role === 'Hospital' &&
              detail.Hospital_ID &&
              detail.Request_Status === 'Pending' && (
                <Button onClick={() => fulfil(detail)}>
                  Complete fulfilment
                </Button>
              )}
          </div>
        </Modal>
      )}

      {/* Custom deletion confirmation */}
      {deleteTarget && (
        <Modal
          title="Confirm request deletion"
          onClose={() => {
            if (!deleteBusy) setDeleteTarget(null);
          }}
        >
          <div className="form-stack">
            <p className="panel-copy">
              Are you sure you want to cancel request BR-{deleteTarget.Request_ID}?
              The record will remain stored in the database for audit history.
            </p>

            <div className="modal-actions">
              <Button
                variant="secondary"
                disabled={deleteBusy}
                onClick={() => setDeleteTarget(null)}
              >
                Keep request
              </Button>

              <Button disabled={deleteBusy} onClick={confirmDelete}>
                {deleteBusy ? 'Deleting...' : 'Confirm deletion'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
function CreateRequestModal({onClose,onCreated}){const [form,setForm]=useState({bloodGroupId:'',quantity:'',urgency:'Medium'});const [busy,setBusy]=useState(false);const toast=useToast();const submit=async(e)=>{e.preventDefault();const qty=Number(form.quantity);if(!form.bloodGroupId||!Number.isFinite(qty)||qty<=0||qty>999.99){toast('Enter a blood group and quantity between 0 and 999.99.','error');return;}setBusy(true);try{const result=await requestApi.create({bloodGroupId:Number(form.bloodGroupId),quantity:qty,urgency:form.urgency});toast(result.syncStatus==='pending'?`Request BR-${result.requestId} saved; donor notification delivery is queued.`:`Request BR-${result.requestId} submitted. ${result.matches} compatible donor notifications were delivered.`,result.syncStatus==='pending'?'error':'success');onCreated();}catch(error){toast(error.message,'error');}finally{setBusy(false);}};return <Modal title="Create blood request" onClose={onClose}><form className="form-stack" onSubmit={submit}><SelectField id="new-request-group" label="Required blood group" required value={form.bloodGroupId} onChange={e=>setForm({...form,bloodGroupId:e.target.value})}><option value="">Select blood group</option>{[[1,'A+'],[2,'A-'],[3,'B+'],[4,'B-'],[5,'AB+'],[6,'AB-'],[7,'O+'],[8,'O-']].map(([id,label])=><option value={id} key={id}>{label}</option>)}</SelectField><Field id="new-request-quantity" label="Quantity required (units)" type="number" min="0.01" max="999.99" step="0.01" required value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})} placeholder="1.00"/><SelectField id="new-request-urgency" label="Urgency" value={form.urgency} onChange={e=>setForm({...form,urgency:e.target.value})}>{['Low','Medium','High','Critical'].map(x=><option key={x}>{x}</option>)}</SelectField><div className="modal-actions"><Button variant="secondary" onClick={onClose}>Back</Button><Button type="submit" disabled={busy}>{busy?'Submittingâ€¦':'Submit request'}</Button></div></form></Modal>;}

export function MatchingPage(){const {user}=useAuth();const [group,setGroup]=useState('O-');const [coordinates,setCoordinates]=useState({longitude:'',latitude:''});const [query,setQuery]=useState(null);const [busy,setBusy]=useState(false);const [result,setResult]=useState(null);const [error,setError]=useState('');const toast=useToast();const search=async(e)=>{e.preventDefault();setBusy(true);setError('');setResult(null);try{let coords=null;const hasLon=coordinates.longitude!=='',hasLat=coordinates.latitude!=='';if(hasLon!==hasLat)throw new Error('Enter both longitude and latitude, or leave both blank.');if(hasLon){const longitude=Number(coordinates.longitude),latitude=Number(coordinates.latitude);if(!Number.isFinite(longitude)||!Number.isFinite(latitude)||Math.abs(longitude)>180||Math.abs(latitude)>90)throw new Error('Enter valid longitude and latitude coordinates.');coords={longitude,latitude};}const data=user?.Role==='Hospital'?await hospitalApi.matching(group,coords):user?.Role==='Organization'?await organizationApi.matching(group,coords):await matchingApi(group,coords);setResult(data);setQuery({group,coords});if(!data.matches?.length)toast('No available compatible donors were found.','error');}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <><PageHeading eyebrow="MATCHING ENGINE / LIVE QUERY" title="Find compatible donors." description="Results use MySQL blood groups and availability, with location ranking when you provide requester coordinates."/><Panel className="matching-query"><PanelTitle label="SEARCH PARAMETERS" title="Define the need"/><form className="match-form" onSubmit={search}><SelectField id="match-group" label="Recipient blood group" value={group} onChange={e=>setGroup(e.target.value)}>{['O-','O+','A-','A+','B-','B+','AB-','AB+'].map(x=><option key={x}>{x}</option>)}</SelectField><Field id="match-lon" label="Requester longitude (optional)" type="number" step="any" value={coordinates.longitude} onChange={e=>setCoordinates({...coordinates,longitude:e.target.value})} placeholder="77.5946"/><Field id="match-lat" label="Requester latitude (optional)" type="number" step="any" value={coordinates.latitude} onChange={e=>setCoordinates({...coordinates,latitude:e.target.value})} placeholder="12.9716"/><Button type="submit" disabled={busy} icon={Search}>{busy?'Searchingâ€¦':'Search matches'}</Button></form><p className="field-hint">Leave both coordinates blank for compatibility-only results. Donor locations are never inferred.</p></Panel>{error&&<div className="form-alert" role="alert">{error}</div>}{result&&<><div className="match-result-head"><div><SectionLabel>RESULTS / {query.group}</SectionLabel><h2>{result.matches.length} compatible donor{result.matches.length===1?'':'s'}</h2><p>{result.geographicRanking?'Ranked by MongoDB geospatial proximity.':'Compatibility matches, ranked using donation history and last-donation date.'}</p></div><span className={`result-indicator ${result.geographicRanking?'result-geo':''}`}><MapPin size={15}/>{result.geographicRanking?'Distance ranked':'No distance applied'}</span></div><div className="match-list">{result.matches.map((donor,index)=><DonorMatch key={donor.donorId} donor={donor} index={index} recipient={query.group}/>)}</div><SummaryBand>{result.clinicalDisclaimer}</SummaryBand></>}{!result&&!busy&&!error&&<EmptyState title="Ready to search" description="Set the recipient blood group and optional requester coordinates to retrieve live donor matches."/>}</>;
}
function DonorMatch({donor,index,recipient}){return <Panel className="match-card"><div className="match-rank">{String(index+1).padStart(2,'0')}<small>RANK</small></div><div className="match-person"><span className="match-avatar">{(donor.name||'D').split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase()}</span><div><h3>{donor.name||`Donor ${donor.donorId}`}</h3><span className="mono-label">DONOR ID / {donor.donorId}</span>{donor.phone&&<a className="donor-contact" href={`tel:${donor.phone}`}>Contact {donor.phone}</a>}</div></div><div className="match-criteria"><div><span className="mono-label">BLOOD GROUP</span><BloodBadge group={donor.bloodGroup}/></div><div><span className="mono-label">AVAILABILITY</span><StatusBadge status={donor.availability?'Available':'Unavailable'}/></div><div><span className="mono-label">LOCATION</span><strong>{[donor.location?.area,donor.location?.city].filter(Boolean).join(', ')||'Location not recorded'}</strong></div><div><span className="mono-label">LAST DONATION</span><strong>{dateText(donor.lastDonationDate)}</strong></div>{donor.distanceRank&&<div><span className="mono-label">PROXIMITY</span><strong>Distance rank #{donor.distanceRank}</strong></div>}<div><span className="mono-label">HISTORY</span><strong>{donor.approvedDonationCount} approved donation{donor.approvedDonationCount===1?'':'s'}</strong></div></div><div className="match-reason"><Check size={15}/><span>Compatible with {recipient}; donor is marked available.</span></div></Panel>;}

export function InventoryPage(){const {user}=useAuth();const [edit,setEdit]=useState(null);const toast=useToast();const loader=useCallback(()=>user?.Role==='Admin'?inventoryApi.adminList():hospitalApi.inventory(),[user?.Role]);const result=useRemote(loader,[user?.Role]);const rows=result.data?.inventory||[];const columns=user?.Role==='Admin'?[{key:'Hospital_Name',label:'Hospital'},{key:'Blood_Type',label:'Blood group',render:x=><BloodBadge group={groupName(x)}/>},{key:'Quantity_Available',label:'Available',render:x=>`${Number(x.Quantity_Available||0).toFixed(2)} units`},{key:'Last_Updated',label:'Last updated',render:x=>dateText(x.Last_Updated)},{key:'action',label:'Action',render:x=><button className="table-action" onClick={()=>setEdit(x)}>Adjust quantity</button>}]:[{key:'group',label:'Blood group',render:x=><BloodBadge group={groupName(x)}/>},{key:'Quantity_Available',label:'Available',render:x=><strong className="stock-value">{Number(x.Quantity_Available||0).toFixed(2)} <small>units</small></strong>},{key:'Last_Updated',label:'Last updated',render:x=>dateText(x.Last_Updated)}];return <><PageHeading eyebrow="INVENTORY / STOCK BAY" title={user?.Role==='Admin'?'Hospital inventory':'Blood inventory'} description={user?.Role==='Admin'?'Review live hospital stock and set a validated inventory quantity.':'Review the inventory recorded for your hospital.'}/><Panel><PanelTitle label="MYSQL / LIVE" title="Inventory register"/><Loadable {...result}><DataTable rowKey="Inventory_ID" rows={rows} columns={columns} emptyTitle="No inventory records" emptyDescription="Inventory appears after an approved donation or administrator update."/></Loadable></Panel><SummaryBand>Quantity updates are validated by the backend. No clinical availability thresholds are inferred.</SummaryBand>{edit&&<InventoryModal row={edit} onClose={()=>setEdit(null)} onSaved={()=>{setEdit(null);result.refresh();toast('Inventory quantity updated.');}}/>}</>;}
function InventoryModal({row,onClose,onSaved}){const [quantity,setQuantity]=useState(Number(row.Quantity_Available||0));const [busy,setBusy]=useState(false);const toast=useToast();const save=async(e)=>{e.preventDefault();if(quantity<0||quantity>999.99){toast('Enter a quantity between 0 and 999.99.','error');return;}setBusy(true);try{await inventoryApi.update(row.Hospital_ID,row.BloodGroup_ID,quantity);onSaved();}catch(error){toast(error.message,'error');}finally{setBusy(false);}};return <Modal title="Set inventory quantity" onClose={onClose}><form className="form-stack" onSubmit={save}><div className="inventory-target"><span>{row.Hospital_Name}</span><BloodBadge group={groupName(row)}/></div><Field id="inventory-quantity" label="Available quantity (units)" type="number" min="0" max="999.99" step="0.01" required value={quantity} onChange={e=>setQuantity(e.target.value)}/><div className="modal-actions"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy}>{busy?'Updatingâ€¦':'Save quantity'}</Button></div></form></Modal>;}

 export function DonationsPage(){const {user}=useAuth();const [compose,setCompose]=useState(false);const toast=useToast();const loader=useCallback(async()=>{const records=await donationApi.list();const stats=user?.Role==='Admin'?await adminApi.donations():null;return{rows:records.donations||[],stats:stats?.statistics||[]};},[user?.Role]);const result=useRemote(loader,[user?.Role]);const changeStatus=async(row,status)=>{if(!window.confirm(`${status} donation #${row.Donation_ID}?`))return;try{const response=await donationApi.status(row.Donation_ID,status);toast(response.syncStatus==='pending'?`Donation ${status.toLowerCase()}; history synchronization is pending.`:`Donation ${status.toLowerCase()}.`,response.syncStatus==='pending'?'error':'success');result.refresh();}catch(e){toast(e.message,'error');}};const columns=[{key:'Donation_ID',label:'Donation'},{key:'Donor_ID',label:'Donor ID',render:x=>`#${x.Donor_ID}`},{key:'BloodGroup_ID',label:'Blood group',render:x=><BloodBadge group={groupById[x.BloodGroup_ID]||`BG-${x.BloodGroup_ID}`}/>},{key:'Hospital_ID',label:'Hospital ID',render:x=>x.Hospital_ID?`#${x.Hospital_ID}`:'Admin review only'},{key:'Donation_Date',label:'Date',render:x=>dateText(x.Donation_Date)},{key:'Quantity',label:'Quantity',render:x=>`${Number(x.Quantity).toFixed(2)} units`},{key:'Donation_Status',label:'Status',render:x=><StatusBadge status={x.Donation_Status}/>},...(['Hospital','Admin'].includes(user?.Role)?[{key:'actions',label:'Action',render:x=>x.Donation_Status==='Pending'?<div className="table-actions"><button className="table-action table-action-good" onClick={()=>changeStatus(x,'Approved')}>Approve</button><button className="table-action table-action-warn" onClick={()=>changeStatus(x,'Rejected')}>Reject</button></div>:'â€”'}]:[])];return <><PageHeading eyebrow={`${user?.Role?.toUpperCase()} / DONATION RECORDS`} title={user?.Role==='Donor'?'My donation history':'Donation management'} description={user?.Role==='Donor'?'Review donation records and submit a new donation record.':'Review donation records associated with your permissions.'} action={user?.Role==='Donor'&&<Button onClick={()=>setCompose(true)} icon={Plus}>Record donation</Button>}/>{user?.Role==='Admin'&&<div className="metric-grid metric-grid-compact">{(result.data?.stats||[]).map(x=><MetricCard key={x.Donation_Status} label={x.Donation_Status.toUpperCase()} value={x.count} detail={`${Number(x.quantity).toFixed(2)} units recorded`} icon={Droplet}/>)}</div>}<Panel><PanelTitle label="DONATIONS / MYSQL AUTHORITY" title="Donation register"/><Loadable {...result}><DataTable rowKey="Donation_ID" rows={result.data?.rows||[]} columns={columns} emptyTitle="No donation records" emptyDescription="New records will appear here when a donor submits them."/></Loadable></Panel>{compose&&<DonationModal onClose={()=>setCompose(false)} onSaved={(response)=>{setCompose(false);result.refresh();toast(response.syncStatus==='pending'?'Donation saved; history synchronization is pending.':'Donation record submitted for review.',response.syncStatus==='pending'?'error':'success');}}/>}</>;}
function DonationModal({onClose,onSaved}){
 const [quantity,setQuantity]=useState('');
 const [date,setDate]=useState(localDateOnly);
 const [hospitalId,setHospitalId]=useState('');
 const [hospitals,setHospitals]=useState([]);
 const [loadingHospitals,setLoadingHospitals]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const toast=useToast();
 useEffect(()=>{let active=true;hospitalApi.donationOptions().then(({hospitals:items})=>{if(active)setHospitals(items||[]);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoadingHospitals(false);});return()=>{active=false;};},[]);
 const submit=async(e)=>{e.preventDefault();if(!hospitalId){toast('Select a receiving hospital.','error');return;}if(!Number(quantity)||Number(quantity)>999.99){toast('Enter a quantity greater than 0 and no more than 999.99.','error');return;}setBusy(true);try{const result=await donationApi.create({quantity:Number(quantity),donationDate:date,hospitalId:Number(hospitalId)});onSaved(result);}catch(e){toast(e.message,'error');}finally{setBusy(false);}};
 return <Modal title="Submit a donation record" onClose={onClose}><form className="form-stack" onSubmit={submit}><Field id="donation-date" label="Donation date" type="date" required value={date} onChange={e=>setDate(e.target.value)}/><Field id="donation-quantity" label="Quantity (units)" type="number" min="0.01" max="999.99" step="0.01" required value={quantity} onChange={e=>setQuantity(e.target.value)} placeholder="1.00"/><SelectField id="receiving-hospital" label="Receiving hospital" required value={hospitalId} onChange={e=>setHospitalId(e.target.value)} disabled={loadingHospitals||!!error}><option value="">{loadingHospitals?'Loading hospitalsâ€¦':error?'Hospitals unavailable':'Select a hospital'}</option>{hospitals.map(h=><option key={h.Hospital_ID} value={h.Hospital_ID}>{h.Hospital_Name}{h.Address?` â€” ${h.Address}`:''}</option>)}</SelectField>{error&&<div className="form-alert" role="alert">{error}</div>}<SummaryBand>The record will be submitted as pending to the selected hospital. Its review updates inventory only after approval.</SummaryBand><div className="modal-actions"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy||loadingHospitals||!!error||!hospitals.length}>{busy?'Submittingâ€¦':'Submit record'}</Button></div></form></Modal>;
}

export function IntegrationStatusPage(){
 const toast=useToast();
 const result=useRemote(()=>adminApi.integrationStatus(100),[]);
 const retry=async(id)=>{try{const response=await adminApi.retryIntegrationEvent(id);toast(`Event ${id}: ${response.status}.`);result.refresh();}catch(e){toast(e.message,'error');}};
 const columns=[{key:'Event_ID',label:'Event'},{key:'Event_Type',label:'Type'},{key:'Aggregate_Type',label:'Record type'},{key:'Aggregate_ID',label:'Record ID'},{key:'Status',label:'Status',render:x=><StatusBadge status={x.Status}/>},{key:'Attempt_Count',label:'Attempts'},{key:'Last_Error',label:'Last error',render:x=>x.Last_Error||'â€”'},{key:'actions',label:'Action',render:x=>x.Status==='Failed'?<button className="table-action" onClick={()=>retry(x.Event_ID)}>Retry</button>:'â€”'}];
 const counts=result.data?.counts||{};
 return <><PageHeading eyebrow="ADMIN / CROSS-DATABASE DELIVERY" title="Integration status" description="Outbox events show MongoDB synchronization progress. Pending events retry automatically; failed events can be retried here."/><SummaryBand label="DELIVERY COUNTS">Pending {counts.pending||0} Â· Processing {counts.processing||0} Â· Failed {counts.failed||0} Â· Processed {counts.processed||0}</SummaryBand><Panel><PanelTitle label="MYSQL OUTBOX / RECENT EVENTS" title="Synchronization queue"/><Loadable {...result}><DataTable rowKey="Event_ID" rows={result.data?.events||[]} columns={columns} emptyTitle="No integration events" emptyDescription="Business events requiring MongoDB synchronization will appear here."/></Loadable></Panel></>;
}

export function NotificationsPage(){const [unread,setUnread]=useState(false);const toast=useToast();const loader=useCallback(()=>notificationApi.list(unread),[unread]);const result=useRemote(loader,[unread]);const mark=async(item)=>{try{await notificationApi.markRead(item._id);toast('Notification marked as read.');result.refresh();}catch(e){toast(e.message,'error');}};return <><PageHeading eyebrow="OUTPUT DECK / NOTIFICATIONS" title="Notification center" description="Request and donation updates addressed to your account."/><div className="filter-bar"><div className="filter-title"><Bell size={16}/><span>{unread?'Unread messages':'All messages'}</span></div><label className="check-filter"><input type="checkbox" checked={unread} onChange={e=>setUnread(e.target.checked)}/>Unread only</label></div><Panel><PanelTitle label="MONGODB / PERSONAL INBOX" title="Messages"/><Loadable {...result}>{result.data?.notifications.length?<div className="notification-list">{result.data.notifications.map(item=><article key={item._id} className={`notification-item ${item.is_read?'read':''}`}><div className="notification-marker"><Bell size={17}/></div><div className="notification-copy"><div className="notification-meta"><span className="mono-label">{item.notification_type||'UPDATE'}</span><time>{dateText(item.created_at)}</time></div><h3>{item.title}</h3><p>{item.message}</p>{item.related_request_id&&<small>Request BR-{item.related_request_id}</small>}</div>{!item.is_read&&<Button variant="secondary" onClick={()=>mark(item)}>Mark read</Button>}</article>)}</div>:<EmptyState title={unread?'Youâ€™re all caught up':'No notifications yet'} description={unread?'There are no unread messages for this account.':'Request and donation updates addressed to you will appear here.'}/>}</Loadable></Panel></>;}

export function AdminTablePage({kind}){const loader=useCallback(async()=>{if(kind==='users')return(await adminApi.users()).users;if(kind==='donors')return(await adminApi.donors()).donors;const o=await adminApi.organizations();return[...(o.hospitals||[]).map(x=>({...x,entityType:'Hospital',_rowKey:`Hospital-${x.Hospital_ID}`})),...(o.organizations||[]).map(x=>({...x,entityType:'Organization',_rowKey:`Organization-${x.Organization_ID}`}))];},[kind]);const result=useRemote(loader,[kind]);const columns=kind==='users'?[{key:'User_ID',label:'User ID'},{key:'Name',label:'Name'},{key:'Email',label:'Email'},{key:'Phone',label:'Phone'},{key:'Role',label:'Role',render:x=><StatusBadge status={x.Role}/>}]:kind==='donors'?[{key:'Donor_ID',label:'Donor ID'},{key:'Name',label:'Donor'},{key:'Email',label:'Email'},{key:'BloodGroup_ID',label:'Blood group',render:x=><BloodBadge group={groupById[x.BloodGroup_ID]||`BG-${x.BloodGroup_ID}`}/>},{key:'Availability_Status',label:'Availability',render:x=><StatusBadge status={x.Availability_Status?'Available':'Unavailable'}/>},{key:'Last_Donation_Date',label:'Last donation',render:x=>dateText(x.Last_Donation_Date)}]:[{key:'entityType',label:'Type',render:x=><StatusBadge status={x.entityType}/>},{key:'Hospital_Name',label:'Name',render:x=>x.Hospital_Name||x.Organization_Name},{key:'Address',label:'Address'},{key:'Phone',label:'Phone'},{key:'Email',label:'Email'},{key:'Organization_Type',label:'Type detail'}];const title=kind==='users'?'User directory':kind==='donors'?'Donor overview':'Hospitals and organizations';return <><PageHeading eyebrow={`ADMIN / ${kind.toUpperCase()}`} title={title} description="Platform-wide records from the relational database. Sensitive credentials are never exposed."/><Panel><PanelTitle label="ADMIN DATA / LIVE" title={title}/><Loadable {...result}><DataTable rowKey={kind==='users'?'User_ID':kind==='donors'?'Donor_ID':'_rowKey'} rows={result.data||[]} columns={columns} emptyTitle="No records available" emptyDescription="Records will appear as the platform is used."/></Loadable></Panel></>;}

